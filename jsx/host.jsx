(function (global) {
  var Sequoia = global.Sequoia || {};

  function getLayerBounds(layer, time) {
    try {
      var bounds = layer.sourceRectAtTime(time, true);

      if (
        bounds &&
        isFinite(bounds.left) &&
        isFinite(bounds.top) &&
        isFinite(bounds.width) &&
        isFinite(bounds.height)
      ) {
        return bounds;
      }
    } catch (error) {
      void error;
    }

    return {
      left: 0,
      top: 0,
      width: layer.width || 0,
      height: layer.height || 0
    };
  }

  function setPropertyValue(property, value, time) {
    try {
      if (property.numKeys > 0) {
        property.setValueAtTime(time, value);
      } else {
        property.setValue(value);
      }

      return true;
    } catch (error) {
      void error;
      return false;
    }
  }

  function trimValueDimensions(value, dimensions) {
    var result = [];

    for (var index = 0; index < dimensions; index += 1) {
      result.push(value[index] || 0);
    }

    return result;
  }

  function rotateVectorAxis(vector, axis, degrees) {
    var angle = (degrees || 0) * Math.PI / 180;
    var cosine = Math.cos(angle);
    var sine = Math.sin(angle);
    var x = vector[0] || 0;
    var y = vector[1] || 0;
    var z = vector[2] || 0;

    if (axis === 0) {
      return [x, y * cosine - z * sine, y * sine + z * cosine];
    }

    if (axis === 1) {
      return [x * cosine + z * sine, y, -x * sine + z * cosine];
    }

    return [x * cosine - y * sine, x * sine + y * cosine, z];
  }

  function getTransformAngle(transform, matchName) {
    try {
      var property = transform.property(matchName);
      return property && typeof property.value === "number" ? property.value : 0;
    } catch (error) {
      void error;
      return 0;
    }
  }

  function anchorDeltaToPositionDelta(layer, transform, delta) {
    var scale = [100, 100, 100];

    try {
      var scaleValue = transform.property("ADBE Scale").value;

      for (var index = 0; index < scaleValue.length && index < 3; index += 1) {
        scale[index] = scaleValue[index] || 0;
      }
    } catch (error) {
      void error;
    }

    var result = [
      ((delta[0] || 0) * scale[0]) / 100,
      ((delta[1] || 0) * scale[1]) / 100,
      ((delta[2] || 0) * scale[2]) / 100
    ];

    if (layer.threeDLayer === true) {
      result = rotateVectorAxis(
        result,
        0,
        getTransformAngle(transform, "ADBE Rotate X")
      );
      result = rotateVectorAxis(
        result,
        1,
        getTransformAngle(transform, "ADBE Rotate Y")
      );
      result = rotateVectorAxis(
        result,
        2,
        getTransformAngle(transform, "ADBE Rotate Z")
      );

      try {
        var orientation = transform.property("ADBE Orientation").value;
        result = rotateVectorAxis(result, 0, orientation[0]);
        result = rotateVectorAxis(result, 1, orientation[1]);
        result = rotateVectorAxis(result, 2, orientation[2]);
      } catch (error) {
        void error;
      }
    } else {
      result = rotateVectorAxis(
        result,
        2,
        getTransformAngle(transform, "ADBE Rotate Z")
      );
    }

    return result;
  }

  function addPositionDelta(position, delta) {
    var result = [];
    var dimensions = position && position.length ? position.length : 2;

    for (var index = 0; index < dimensions; index += 1) {
      result.push((position[index] || 0) + (delta[index] || 0));
    }

    return result;
  }

  function setPositionValue(position, value, time) {
    try {
      if (position.dimensionsSeparated === true) {
        var currentValue = position.value;
        var dimensions = currentValue && currentValue.length
          ? currentValue.length
          : 2;

        for (var index = 0; index < dimensions; index += 1) {
          if (!setPropertyValue(
            position.getSeparationFollower(index),
            value[index] || 0,
            time
          )) {
            return false;
          }
        }

        return true;
      }
    } catch (error) {
      void error;
    }

    var positionValue = position.value;
    var positionDimensions = positionValue && positionValue.length
      ? positionValue.length
      : 2;

    return setPropertyValue(
      position,
      trimValueDimensions(value, positionDimensions),
      time
    );
  }

  var lastAnchorPointError = "";

  function setLayerAnchorPoint(layer, horizontal, vertical, time) {
    var transform = layer.property
      ? layer.property("ADBE Transform Group")
      : null;
    var anchorPoint = transform
      ? transform.property("ADBE Anchor Point")
      : null;
    var position = transform ? transform.property("ADBE Position") : null;

    if (!anchorPoint || !position) {
      lastAnchorPointError = "The layer has no editable Anchor Point and Position.";
      return false;
    }

    var bounds = getLayerBounds(layer, time);
    var oldAnchor = anchorPoint.value;
    var newAnchor = [
      bounds.left + bounds.width * horizontal,
      bounds.top + bounds.height * vertical,
      oldAnchor.length > 2 ? oldAnchor[2] || 0 : 0
    ];
    var anchorDimensions = oldAnchor && oldAnchor.length ? oldAnchor.length : 2;
    var wasLocked = false;

    try {
      wasLocked = layer.locked === true;

      if (wasLocked) {
        layer.locked = false;
      }

      var oldPosition = position.value;
      var anchorDelta = [
        (newAnchor[0] || 0) - (oldAnchor[0] || 0),
        (newAnchor[1] || 0) - (oldAnchor[1] || 0),
        (newAnchor[2] || 0) - (oldAnchor[2] || 0)
      ];
      var positionDelta = anchorDeltaToPositionDelta(
        layer,
        transform,
        anchorDelta
      );

      if (!setPropertyValue(
        anchorPoint,
        trimValueDimensions(newAnchor, anchorDimensions),
        time
      )) {
        lastAnchorPointError = "After Effects rejected the Anchor Point value.";
        return false;
      }

      if (setPositionValue(
        position,
        addPositionDelta(oldPosition, positionDelta),
        time
      )) {
        return true;
      }

      setPropertyValue(anchorPoint, oldAnchor, time);
      lastAnchorPointError = "After Effects rejected the Position compensation.";
      return false;
    } catch (error) {
      lastAnchorPointError = error && error.toString
        ? error.toString()
        : "Unknown Anchor Point error.";
      return false;
    } finally {
      try {
        if (wasLocked) {
          layer.locked = true;
        }
      } catch (error) {
        void error;
      }
    }
  }

  var minimumEaseInfluence = 0.1;
  var normalizedHandleEpsilon = minimumEaseInfluence / 100;
  var spatialLengthSubdivisions = 32;

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function getNumberComponents(value) {
    if (isFiniteNumber(value)) {
      return [value];
    }

    if (!value || typeof value.length !== "number" || value.length === 0) {
      return null;
    }

    var components = [];

    for (var index = 0; index < value.length; index += 1) {
      if (!isFiniteNumber(value[index])) {
        return null;
      }

      components.push(value[index]);
    }

    return components;
  }

  function getSelectedKeyframeProperties(composition) {
    var selectedProperties = composition.selectedProperties;
    var keyframeProperties = [];

    for (var index = 0; index < selectedProperties.length; index += 1) {
      try {
        var property = selectedProperties[index];

        if (
          property.propertyType === PropertyType.PROPERTY &&
          property.numKeys > 0 &&
          property.selectedKeys.length > 0
        ) {
          keyframeProperties.push(property);
        }
      } catch (error) {
        void error;
      }
    }

    return keyframeProperties;
  }

  function isSpatialProperty(property) {
    return (
      property.propertyValueType === PropertyValueType.TwoD_SPATIAL ||
      property.propertyValueType === PropertyValueType.ThreeD_SPATIAL
    );
  }

  function vectorDistance(first, second) {
    var squaredDistance = 0;

    for (var index = 0; index < first.length; index += 1) {
      var delta = second[index] - first[index];
      squaredDistance += delta * delta;
    }

    return Math.sqrt(squaredDistance);
  }

  function cubicValue(start, firstHandle, secondHandle, end, amount) {
    var inverse = 1 - amount;

    return (
      inverse * inverse * inverse * start +
      3 * inverse * inverse * amount * firstHandle +
      3 * inverse * amount * amount * secondHandle +
      amount * amount * amount * end
    );
  }

  function getSpatialPathLength(property, startKey, endKey, start, end) {
    try {
      var outTangent = property.keyOutSpatialTangent(startKey);
      var inTangent = property.keyInSpatialTangent(endKey);
      var firstHandle = [];
      var secondHandle = [];

      for (var dimension = 0; dimension < start.length; dimension += 1) {
        firstHandle.push(start[dimension] + outTangent[dimension]);
        secondHandle.push(end[dimension] + inTangent[dimension]);
      }

      var previousPoint = start;
      var pathLength = 0;

      for (
        var sample = 1;
        sample <= spatialLengthSubdivisions;
        sample += 1
      ) {
        var amount = sample / spatialLengthSubdivisions;
        var point = [];

        for (
          var pointDimension = 0;
          pointDimension < start.length;
          pointDimension += 1
        ) {
          point.push(
            cubicValue(
              start[pointDimension],
              firstHandle[pointDimension],
              secondHandle[pointDimension],
              end[pointDimension],
              amount
            )
          );
        }

        pathLength += vectorDistance(previousPoint, point);
        previousPoint = point;
      }

      return pathLength;
    } catch (error) {
      void error;
      return vectorDistance(start, end);
    }
  }

  function getAverageSpeeds(property, startKey, endKey) {
    var duration = property.keyTime(endKey) - property.keyTime(startKey);

    if (!(duration > 0)) {
      return null;
    }

    var start = getNumberComponents(property.keyValue(startKey));
    var end = getNumberComponents(property.keyValue(endKey));

    if (!start || !end || start.length !== end.length) {
      return null;
    }

    if (property.propertyValueType === PropertyValueType.TwoD) {
      if (start.length !== 2) {
        return null;
      }

      return [
        Math.abs(end[0] - start[0]) / duration,
        Math.abs(end[1] - start[1]) / duration
      ];
    }

    if (property.propertyValueType === PropertyValueType.ThreeD) {
      if (start.length !== 3) {
        return null;
      }

      return [
        Math.abs(end[0] - start[0]) / duration,
        Math.abs(end[1] - start[1]) / duration,
        Math.abs(end[2] - start[2]) / duration
      ];
    }

    if (isSpatialProperty(property)) {
      return [
        getSpatialPathLength(property, startKey, endKey, start, end) /
          duration
      ];
    }

    if (start.length === 1) {
      return [Math.abs(end[0] - start[0]) / duration];
    }

    return [vectorDistance(start, end) / duration];
  }

  function createEaseArray(averageSpeeds, speedFactor, influence) {
    var eases = [];

    for (var index = 0; index < averageSpeeds.length; index += 1) {
      var speed = averageSpeeds[index] * speedFactor;

      if (!isFiniteNumber(speed)) {
        return null;
      }

      eases.push(new KeyframeEase(speed, influence));
    }

    return eases;
  }

  function getStartSpeedFactor(x1, y1, x2, y2) {
    if (x1 > normalizedHandleEpsilon) {
      return y1 / x1;
    }

    if (y1 > normalizedHandleEpsilon) {
      return y1 / normalizedHandleEpsilon;
    }

    if (x2 > normalizedHandleEpsilon) {
      return y2 / x2;
    }

    if (y2 > normalizedHandleEpsilon) {
      return y2 / normalizedHandleEpsilon;
    }

    return 1;
  }

  function getEndSpeedFactor(x1, y1, x2, y2) {
    var endHandleX = 1 - x2;
    var endHandleY = 1 - y2;

    if (endHandleX > normalizedHandleEpsilon) {
      return endHandleY / endHandleX;
    }

    if (endHandleY > normalizedHandleEpsilon) {
      return endHandleY / normalizedHandleEpsilon;
    }

    var startHandleX = 1 - x1;
    var startHandleY = 1 - y1;

    if (startHandleX > normalizedHandleEpsilon) {
      return startHandleY / startHandleX;
    }

    if (startHandleY > normalizedHandleEpsilon) {
      return startHandleY / normalizedHandleEpsilon;
    }

    return 1;
  }

  function lockSpatialKey(property, keyIndex) {
    if (!isSpatialProperty(property)) {
      return;
    }

    try {
      property.setRovingAtKey(keyIndex, false);
    } catch (error) {
      void error;
    }
  }

  function applyEasingToPair(
    property,
    startKey,
    endKey,
    outSpeedFactor,
    outInfluence,
    inSpeedFactor,
    inInfluence
  ) {
    var averageSpeeds = getAverageSpeeds(property, startKey, endKey);

    if (!averageSpeeds) {
      return false;
    }

    var newOutEase = createEaseArray(
      averageSpeeds,
      outSpeedFactor,
      outInfluence
    );
    var newInEase = createEaseArray(
      averageSpeeds,
      inSpeedFactor,
      inInfluence
    );

    if (!newOutEase || !newInEase) {
      return false;
    }

    var startInEase = property.keyInTemporalEase(startKey);
    var startInType = property.keyInInterpolationType(startKey);
    var endOutEase = property.keyOutTemporalEase(endKey);
    var endOutType = property.keyOutInterpolationType(endKey);

    lockSpatialKey(property, startKey);
    lockSpatialKey(property, endKey);

    property.setInterpolationTypeAtKey(
      startKey,
      startInType,
      KeyframeInterpolationType.BEZIER
    );
    property.setTemporalAutoBezierAtKey(startKey, false);
    property.setTemporalContinuousAtKey(startKey, false);
    property.setTemporalEaseAtKey(startKey, startInEase, newOutEase);

    property.setInterpolationTypeAtKey(
      endKey,
      KeyframeInterpolationType.BEZIER,
      endOutType
    );
    property.setTemporalAutoBezierAtKey(endKey, false);
    property.setTemporalContinuousAtKey(endKey, false);
    property.setTemporalEaseAtKey(endKey, newInEase, endOutEase);

    return true;
  }

  var bounceLegacyExpressionMarker = "// SEQUOIA_BOUNCE_V1|";
  var bounceExpressionMarker = "// SEQUOIA_BOUNCE_V2|";
  var bouncePseudoEffectMatchName = "Pseudo/Sequoia Bounce";
  var bounceControlDefaults = [20, 1, 60];
  var overshootExpressionMarker = "// SEQUOIA_OVERSHOOT_V1|";
  var overshootPseudoEffectMatchName = "Pseudo/Sequoia Overshoot";
  var overshootControlDefaults = [20, 1, 60];

  function getPropertyIndexPath(property) {
    var path = [];
    var currentProperty = property;

    while (currentProperty && currentProperty.propertyDepth > 0) {
      path.unshift(currentProperty.propertyIndex);
      currentProperty = currentProperty.parentProperty;
    }

    return path;
  }

  function resolvePropertyIndexPath(layer, path) {
    var property = layer;

    for (var index = 0; index < path.length; index += 1) {
      property = property.property(path[index]);

      if (!property) {
        return null;
      }
    }

    return property;
  }

  function isBounceValueType(property) {
    var valueType = property.propertyValueType;

    return (
      valueType === PropertyValueType.OneD ||
      valueType === PropertyValueType.TwoD ||
      valueType === PropertyValueType.ThreeD ||
      valueType === PropertyValueType.TwoD_SPATIAL ||
      valueType === PropertyValueType.ThreeD_SPATIAL
    );
  }

  function isSequoiaBounceControl(property) {
    var currentProperty = property.parentProperty;

    while (currentProperty) {
      try {
        if (
          currentProperty.matchName === bouncePseudoEffectMatchName ||
          (
            currentProperty.matchName === "ADBE Slider Control" &&
            currentProperty.name.indexOf("Bounce ") === 0
          )
        ) {
          return true;
        }
      } catch (error) {
        void error;
      }

      currentProperty = currentProperty.parentProperty;
    }

    return false;
  }

  function sanitizeBounceLabel(label) {
    var sanitized = String(label || "")
      .replace(/[\\|"'\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s+|\s+$/g, "");

    if (!sanitized) {
      sanitized = "Property";
    }

    return sanitized.substring(0, 48);
  }

  function quoteExpressionString(value) {
    return (
      "\"" +
      String(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n") +
      "\""
    );
  }

  function getSliderControl(effects, name) {
    try {
      var effect = effects.property(name);

      if (effect && effect.matchName === "ADBE Slider Control") {
        return effect;
      }
    } catch (error) {
      void error;
    }

    return null;
  }

  function effectNameExists(effects, name) {
    for (var index = 1; index <= effects.numProperties; index += 1) {
      try {
        if (effects.property(index).name === name) {
          return true;
        }
      } catch (error) {
        void error;
      }
    }

    return false;
  }

  function getBounceEffect(effects, name) {
    try {
      var effect = effects.property(name);

      if (effect && effect.matchName === bouncePseudoEffectMatchName) {
        return effect;
      }
    } catch (error) {
      void error;
    }

    return null;
  }

  function createBounceEffectName(effects, propertyName) {
    var label = sanitizeBounceLabel(propertyName).substring(0, 15);
    var suffix = 1;

    while (suffix < 1000) {
      var baseName = "Bounce " + label + (suffix > 1 ? " (" + suffix + ")" : "");

      if (!effectNameExists(effects, baseName)) {
        return baseName;
      }

      suffix += 1;
    }

    throw new Error("Could not create a unique Bounce effect name.");
  }

  function readBounceSetup(property) {
    var expression = "";

    try {
      expression = property.expression || "";
    } catch (error) {
      void error;
      return null;
    }

    var firstLineEnd = expression.indexOf("\n");
    var firstLine = firstLineEnd === -1
      ? expression
      : expression.substring(0, firstLineEnd);

    if (firstLine.indexOf(bounceExpressionMarker) === 0) {
      var effectName = firstLine.substring(bounceExpressionMarker.length);

      return effectName
        ? { effectName: effectName, legacyControlNames: null }
        : null;
    }

    if (firstLine.indexOf(bounceLegacyExpressionMarker) === 0) {
      var names = firstLine
        .substring(bounceLegacyExpressionMarker.length)
        .split("|");

      return names.length === 3
        ? { effectName: null, legacyControlNames: names }
        : null;
    }

    return null;
  }

  function buildBounceExpression(effectName) {
    return [
      bounceExpressionMarker + effectName,
      "var __sqAmount = Math.max(0, effect(" +
        quoteExpressionString(effectName) +
        ")(1)) / 100;",
      "var __sqDuration = Math.max(0, effect(" +
        quoteExpressionString(effectName) +
        ")(2));",
      "var __sqElasticity = Math.min(100, Math.max(0, effect(" +
        quoteExpressionString(effectName) +
        ")(3)));",
      "var __sqLastTime = numKeys > 0 ? key(numKeys).time : 0;",
      "if (numKeys < 2 || __sqAmount <= 0 || __sqDuration <= 0 || time <= __sqLastTime || time >= __sqLastTime + __sqDuration) {",
      "  value;",
      "} else {",
      "  var __sqProgress = Math.min(0.999999999, Math.max(0, (time - __sqLastTime) / __sqDuration));",
      "  var __sqRatio = 0.25 + __sqElasticity * 0.005;",
      "  var __sqBounce = Math.floor(Math.log(1 - __sqProgress) / Math.log(__sqRatio));",
      "  var __sqPower = Math.pow(__sqRatio, __sqBounce);",
      "  var __sqStart = 1 - __sqPower;",
      "  var __sqLength = (1 - __sqRatio) * __sqPower;",
      "  var __sqLocal = Math.min(1, Math.max(0, (__sqProgress - __sqStart) / __sqLength));",
      "  var __sqArc = 4 * __sqLocal * (1 - __sqLocal);",
      "  var __sqDecay = Math.pow(__sqRatio, 2 * __sqBounce);",
      "  value + (key(numKeys - 1).value - key(numKeys).value) * __sqAmount * __sqDecay * __sqArc;",
      "}"
    ].join("\n");
  }

  function getLegacyBounceControlValues(effects, controlNames) {
    var values = [];

    for (var index = 0; index < controlNames.length; index += 1) {
      var control = getSliderControl(effects, controlNames[index]);

      if (!control) {
        values.push(bounceControlDefaults[index]);
        continue;
      }

      try {
        values.push(control.property(1).value);
      } catch (error) {
        void error;
        values.push(bounceControlDefaults[index]);
      }
    }

    return values;
  }

  function getBounceEffectValues(effect) {
    var values = [];

    for (var index = 0; index < bounceControlDefaults.length; index += 1) {
      try {
        values.push(effect.property(index + 1).value);
      } catch (error) {
        void error;
        values.push(bounceControlDefaults[index]);
      }
    }

    return values;
  }

  function setBounceEffectValues(effect, values) {
    for (var index = 0; index < bounceControlDefaults.length; index += 1) {
      var control = effect.property(index + 1);

      if (!control) {
        throw new Error("The Bounce pseudo-effect is missing a control.");
      }

      control.setValue(values[index]);
    }
  }

  function isCompleteBounceEffect(effect) {
    if (!effect) {
      return false;
    }

    for (var index = 1; index <= bounceControlDefaults.length; index += 1) {
      try {
        if (!effect.property(index)) {
          return false;
        }
      } catch (error) {
        void error;
        return false;
      }
    }

    return true;
  }

  function getBouncePresetFile() {
    var hostScriptFile = new File($.fileName);
    var extensionFolder = hostScriptFile.parent.parent;
    var presetFile = new File(
      extensionFolder.fsName + "/assets/SequoiaBounce.ffx"
    );

    if (!presetFile.exists) {
      throw new Error("The bundled Bounce pseudo-effect preset is missing.");
    }

    return presetFile;
  }

  function applyPresetToOnlyLayer(layer, presetFile) {
    var composition = layer.containingComp;
    var selection = [];

    for (var index = 1; index <= composition.numLayers; index += 1) {
      selection.push(composition.layer(index).selected === true);
    }

    try {
      for (var deselectIndex = 1; deselectIndex <= composition.numLayers; deselectIndex += 1) {
        composition.layer(deselectIndex).selected = false;
      }

      layer.selected = true;
      layer.applyPreset(presetFile);
    } finally {
      for (var restoreIndex = 1; restoreIndex <= composition.numLayers; restoreIndex += 1) {
        composition.layer(restoreIndex).selected = selection[restoreIndex - 1];
      }
    }
  }

  function addBounceEffect(layer, effectName, values) {
    var effects = layer.property("ADBE Effect Parade");
    var previousEffectCount = effects.numProperties;

    applyPresetToOnlyLayer(layer, getBouncePresetFile());
    effects = layer.property("ADBE Effect Parade");

    for (
      var index = effects.numProperties;
      index > previousEffectCount;
      index -= 1
    ) {
      var effect = effects.property(index);

      if (effect && effect.matchName === bouncePseudoEffectMatchName) {
        effect.name = effectName;
        setBounceEffectValues(effect, values);
        return effect;
      }
    }

    throw new Error("After Effects did not create the Bounce pseudo-effect.");
  }

  function removeBounceEffect(effects, effectName) {
    var effect = getBounceEffect(effects, effectName);

    if (!effect) {
      return;
    }

    try {
      effect.remove();
    } catch (error) {
      void error;
    }
  }

  function removeBounceControls(effects, controlNames) {
    for (var index = controlNames.length - 1; index >= 0; index -= 1) {
      var control = getSliderControl(effects, controlNames[index]);

      if (control) {
        try {
          control.remove();
        } catch (error) {
          void error;
        }
      }
    }
  }

  function restorePropertyExpression(layer, path, expression, wasEnabled) {
    try {
      var property = resolvePropertyIndexPath(layer, path);

      if (!property || property.canSetExpression !== true) {
        return;
      }

      property.expression = expression;

      if (expression) {
        property.expressionEnabled = wasEnabled;
      }
    } catch (error) {
      void error;
    }
  }

  function applyBounceToProperty(target) {
    var property = resolvePropertyIndexPath(target.layer, target.path);

    if (!property) {
      throw new Error("The selected property is no longer available.");
    }

    var effects = target.layer.property("ADBE Effect Parade");

    if (!effects) {
      throw new Error("The property's layer does not support effects.");
    }

    var previousExpression = property.expression || "";
    var previousExpressionEnabled = property.expressionEnabled === true;
    var previousSetup = readBounceSetup(property);
    var previousOvershootSetup = readOvershootSetup(property);
    var previousEffect = previousSetup && previousSetup.effectName
      ? getBounceEffect(effects, previousSetup.effectName)
      : null;
    var controlValues = bounceControlDefaults;
    var effectName = null;
    var createdEffectName = null;
    var staleEffectName = null;
    var staleControlNames = previousSetup
      ? previousSetup.legacyControlNames
      : null;

    if (previousEffect) {
      controlValues = getBounceEffectValues(previousEffect);
    } else if (staleControlNames) {
      controlValues = getLegacyBounceControlValues(effects, staleControlNames);
    }

    if (isCompleteBounceEffect(previousEffect)) {
      return false;
    }

    if (previousEffect) {
      staleEffectName = previousSetup.effectName;
      previousEffect = null;
    }

    try {
      if (previousEffect) {
        effectName = previousSetup.effectName;
      } else {
        effectName = createBounceEffectName(effects, target.name);
        var newEffect = addBounceEffect(
          target.layer,
          effectName,
          controlValues
        );
        createdEffectName = newEffect.name;
        effectName = createdEffectName;
      }

      property = resolvePropertyIndexPath(target.layer, target.path);

      if (!property || property.canSetExpression !== true) {
        throw new Error("The selected property cannot use expressions.");
      }

      property.expression = buildBounceExpression(effectName);
      property.expressionEnabled = true;

      if (property.expressionError) {
        throw new Error(property.expressionError);
      }

      effects = target.layer.property("ADBE Effect Parade");

      if (staleControlNames && staleControlNames.length > 0) {
        removeBounceControls(effects, staleControlNames);
      }

      if (staleEffectName) {
        removeBounceEffect(effects, staleEffectName);
      }

      if (previousOvershootSetup) {
        removeOvershootEffect(effects, previousOvershootSetup.effectName);
      }
    } catch (error) {
      if (createdEffectName) {
        removeBounceEffect(
          target.layer.property("ADBE Effect Parade"),
          createdEffectName
        );
      }

      restorePropertyExpression(
        target.layer,
        target.path,
        previousExpression,
        previousExpressionEnabled
      );
      throw error;
    }

    return true;
  }

  function describeBounceTarget(target) {
    return target.layer.name + " > " + target.name;
  }

  function getSelectedBouncePropertyTargets(composition) {
    var properties = composition.selectedProperties;
    var targets = [];

    for (var index = 0; index < properties.length; index += 1) {
      var property = properties[index];

      try {
        if (
          property.propertyType !== PropertyType.PROPERTY ||
          !readBounceSetup(property)
        ) {
          continue;
        }

        var layer = property.propertyGroup(property.propertyDepth);

        targets.push({
          layer: layer,
          name: sanitizeBounceLabel(property.name),
          path: getPropertyIndexPath(property)
        });
      } catch (error) {
        void error;
      }
    }

    return targets;
  }

  function removeBounceFromProperty(target) {
    var property = resolvePropertyIndexPath(target.layer, target.path);

    if (!property || property.canSetExpression !== true) {
      throw new Error("The selected property is no longer available.");
    }

    var setup = readBounceSetup(property);

    if (!setup) {
      return false;
    }

    var effects = target.layer.property("ADBE Effect Parade");

    if (!effects) {
      throw new Error("The property's layer does not support effects.");
    }

    property.expression = "";

    if (setup.effectName) {
      var effect = getBounceEffect(effects, setup.effectName);

      if (effect) {
        effect.remove();
      }
    } else if (setup.legacyControlNames) {
      for (
        var index = setup.legacyControlNames.length - 1;
        index >= 0;
        index -= 1
      ) {
        var control = getSliderControl(
          effects,
          setup.legacyControlNames[index]
        );

        if (control) {
          control.remove();
        }
      }
    }

    return true;
  }

  function isSequoiaOvershootControl(property) {
    var currentProperty = property.parentProperty;

    while (currentProperty) {
      try {
        if (currentProperty.matchName === overshootPseudoEffectMatchName) {
          return true;
        }
      } catch (error) {
        void error;
      }

      currentProperty = currentProperty.parentProperty;
    }

    return false;
  }

  function getOvershootEffect(effects, name) {
    try {
      var effect = effects.property(name);

      if (effect && effect.matchName === overshootPseudoEffectMatchName) {
        return effect;
      }
    } catch (error) {
      void error;
    }

    return null;
  }

  function createOvershootEffectName(effects, propertyName) {
    var label = sanitizeBounceLabel(propertyName).substring(0, 15);
    var suffix = 1;

    while (suffix < 1000) {
      var baseName = "Overshoot " + label + (suffix > 1 ? " (" + suffix + ")" : "");

      if (!effectNameExists(effects, baseName)) {
        return baseName;
      }

      suffix += 1;
    }

    throw new Error("Could not create a unique Overshoot effect name.");
  }

  function readOvershootSetup(property) {
    var expression = "";

    try {
      expression = property.expression || "";
    } catch (error) {
      void error;
      return null;
    }

    var firstLineEnd = expression.indexOf("\n");
    var firstLine = firstLineEnd === -1
      ? expression
      : expression.substring(0, firstLineEnd);

    if (firstLine.indexOf(overshootExpressionMarker) !== 0) {
      return null;
    }

    var effectName = firstLine.substring(overshootExpressionMarker.length);

    return effectName ? { effectName: effectName } : null;
  }

  function buildOvershootExpression(effectName) {
    return [
      overshootExpressionMarker + effectName,
      "var __sqAmount = Math.max(0, effect(" +
        quoteExpressionString(effectName) +
        ")(1)) / 100;",
      "var __sqDuration = Math.max(0, effect(" +
        quoteExpressionString(effectName) +
        ")(2));",
      "var __sqElasticity = Math.min(100, Math.max(0, effect(" +
        quoteExpressionString(effectName) +
        ")(3)));",
      "var __sqLastTime = numKeys > 0 ? key(numKeys).time : 0;",
      "if (numKeys < 2 || __sqAmount <= 0 || __sqDuration <= 0 || time <= __sqLastTime || time >= __sqLastTime + __sqDuration) {",
      "  value;",
      "} else {",
      "  var __sqProgress = Math.min(1, Math.max(0, (time - __sqLastTime) / __sqDuration));",
      "  var __sqCycles = 1 + __sqElasticity * 0.05;",
      "  var __sqWave = Math.sin(__sqProgress * __sqCycles * Math.PI * 2);",
      "  var __sqDecay = Math.pow(1 - __sqProgress, 2);",
      "  value + (key(numKeys).value - key(numKeys - 1).value) * __sqAmount * __sqWave * __sqDecay;",
      "}"
    ].join("\n");
  }

  function getOvershootEffectValues(effect) {
    var values = [];

    for (var index = 0; index < overshootControlDefaults.length; index += 1) {
      try {
        values.push(effect.property(index + 1).value);
      } catch (error) {
        void error;
        values.push(overshootControlDefaults[index]);
      }
    }

    return values;
  }

  function setOvershootEffectValues(effect, values) {
    for (var index = 0; index < overshootControlDefaults.length; index += 1) {
      var control = effect.property(index + 1);

      if (!control) {
        throw new Error("The Overshoot pseudo-effect is missing a control.");
      }

      control.setValue(values[index]);
    }
  }

  function isCompleteOvershootEffect(effect) {
    if (!effect) {
      return false;
    }

    for (var index = 1; index <= overshootControlDefaults.length; index += 1) {
      try {
        if (!effect.property(index)) {
          return false;
        }
      } catch (error) {
        void error;
        return false;
      }
    }

    return true;
  }

  function getOvershootPresetFile() {
    var hostScriptFile = new File($.fileName);
    var extensionFolder = hostScriptFile.parent.parent;
    var presetFile = new File(
      extensionFolder.fsName + "/assets/SequoiaOvershoot.ffx"
    );

    if (!presetFile.exists) {
      throw new Error("The bundled Overshoot pseudo-effect preset is missing.");
    }

    return presetFile;
  }

  function addOvershootEffect(layer, effectName, values) {
    var effects = layer.property("ADBE Effect Parade");
    var previousEffectCount = effects.numProperties;

    applyPresetToOnlyLayer(layer, getOvershootPresetFile());
    effects = layer.property("ADBE Effect Parade");

    for (
      var index = effects.numProperties;
      index > previousEffectCount;
      index -= 1
    ) {
      var effect = effects.property(index);

      if (effect && effect.matchName === overshootPseudoEffectMatchName) {
        effect.name = effectName;
        setOvershootEffectValues(effect, values);
        return effect;
      }
    }

    throw new Error("After Effects did not create the Overshoot pseudo-effect.");
  }

  function removeOvershootEffect(effects, effectName) {
    var effect = getOvershootEffect(effects, effectName);

    if (!effect) {
      return;
    }

    try {
      effect.remove();
    } catch (error) {
      void error;
    }
  }

  function applyOvershootToProperty(target) {
    var property = resolvePropertyIndexPath(target.layer, target.path);

    if (!property) {
      throw new Error("The selected property is no longer available.");
    }

    var effects = target.layer.property("ADBE Effect Parade");

    if (!effects) {
      throw new Error("The property's layer does not support effects.");
    }

    var previousExpression = property.expression || "";
    var previousExpressionEnabled = property.expressionEnabled === true;
    var previousSetup = readOvershootSetup(property);
    var previousBounceSetup = readBounceSetup(property);
    var previousEffect = previousSetup
      ? getOvershootEffect(effects, previousSetup.effectName)
      : null;
    var controlValues = overshootControlDefaults;
    var createdEffectName = null;
    var staleEffectName = null;

    if (previousEffect) {
      controlValues = getOvershootEffectValues(previousEffect);
    }

    if (isCompleteOvershootEffect(previousEffect)) {
      return false;
    }

    if (previousEffect) {
      staleEffectName = previousSetup.effectName;
    }

    try {
      var effectName = createOvershootEffectName(effects, target.name);
      var newEffect = addOvershootEffect(
        target.layer,
        effectName,
        controlValues
      );
      createdEffectName = newEffect.name;
      effectName = createdEffectName;

      property = resolvePropertyIndexPath(target.layer, target.path);

      if (!property || property.canSetExpression !== true) {
        throw new Error("The selected property cannot use expressions.");
      }

      property.expression = buildOvershootExpression(effectName);
      property.expressionEnabled = true;

      if (property.expressionError) {
        throw new Error(property.expressionError);
      }

      effects = target.layer.property("ADBE Effect Parade");

      if (staleEffectName) {
        removeOvershootEffect(effects, staleEffectName);
      }

      if (previousBounceSetup) {
        if (previousBounceSetup.effectName) {
          removeBounceEffect(effects, previousBounceSetup.effectName);
        } else if (previousBounceSetup.legacyControlNames) {
          removeBounceControls(effects, previousBounceSetup.legacyControlNames);
        }
      }
    } catch (error) {
      if (createdEffectName) {
        removeOvershootEffect(
          target.layer.property("ADBE Effect Parade"),
          createdEffectName
        );
      }

      restorePropertyExpression(
        target.layer,
        target.path,
        previousExpression,
        previousExpressionEnabled
      );
      throw error;
    }

    return true;
  }

  function getSelectedOvershootPropertyTargets(composition) {
    var properties = composition.selectedProperties;
    var targets = [];

    for (var index = 0; index < properties.length; index += 1) {
      var property = properties[index];

      try {
        if (
          property.propertyType !== PropertyType.PROPERTY ||
          !readOvershootSetup(property)
        ) {
          continue;
        }

        var layer = property.propertyGroup(property.propertyDepth);

        targets.push({
          layer: layer,
          name: sanitizeBounceLabel(property.name),
          path: getPropertyIndexPath(property)
        });
      } catch (error) {
        void error;
      }
    }

    return targets;
  }

  function removeOvershootFromProperty(target) {
    var property = resolvePropertyIndexPath(target.layer, target.path);

    if (!property || property.canSetExpression !== true) {
      throw new Error("The selected property is no longer available.");
    }

    var setup = readOvershootSetup(property);

    if (!setup) {
      return false;
    }

    var effects = target.layer.property("ADBE Effect Parade");

    if (!effects) {
      throw new Error("The property's layer does not support effects.");
    }

    property.expression = "";
    removeOvershootEffect(effects, setup.effectName);

    return true;
  }

  var wiggleMotionConfig = {
    controlDefaults: [1, 2, 50, 0, 50, 50, 50, 0, 1, 0],
    controlNames: [
      "Enable",
      "Frequency",
      "Amount",
      "Individual Axis",
      "X",
      "Y",
      "Z",
      "Lock Dimensions",
      "Random Seed",
      "Frame Rate"
    ],
    effectName: "Wiggle",
    expressionMarker: "// SEQUOIA_WIGGLE_V1|",
    legacyMatchNames: ["Pseudo/Sequoia Wiggle"],
    matchName: "Pseudo/Sequoia Wiggle v1",
    presetName: "SequoiaWiggle.ffx",
    undoName: "Apply Wiggle"
  };
  var spinMotionConfig = {
    controlDefaults: [1, 0, 90, 0, 0],
    controlNames: ["Enable", "Reverse", "Speed", "Frame Rate", "Offset"],
    effectName: "Spin",
    expressionMarker: "// SEQUOIA_SPIN_V1|",
    legacyMatchNames: ["Pseudo/Sequoia Spin"],
    matchName: "Pseudo/Sequoia Spin v1",
    presetName: "SequoiaSpin.ffx",
    undoName: "Apply Spin"
  };
  var blinkerMotionConfig = {
    controlDefaults: [1, 8, 1, 35, 100, 0],
    controlNames: [
      "Enable",
      "Speed",
      "Enable Fixed",
      "Random Timing",
      "Max Opacity",
      "Min Opacity"
    ],
    effectName: "Blinker / Flicker",
    expressionMarker: "// SEQUOIA_BLINKER_V1|",
    legacyMatchNames: ["Pseudo/Sequoia Blinker"],
    matchName: "Pseudo/Sequoia Blinker v1",
    presetName: "SequoiaBlinker.ffx",
    undoName: "Apply Blinker / Flicker"
  };
  var faderMotionConfig = {
    controlDefaults: [1, 12, 0],
    controlNames: ["Enable", "Animation", "Linear"],
    effectName: "Fader",
    expressionMarker: "// SEQUOIA_FADER_V1|",
    legacyMatchNames: ["Pseudo/Sequoia Fader"],
    matchName: "Pseudo/Sequoia Fader v1",
    presetName: "SequoiaFader.ffx",
    undoName: "Apply Fader"
  };
  var additionalMotionConfigs = [
    wiggleMotionConfig,
    spinMotionConfig,
    blinkerMotionConfig,
    faderMotionConfig
  ];

  function isMotionEffectMatchName(config, matchName) {
    if (matchName === config.matchName) {
      return true;
    }

    for (var index = 0; index < config.legacyMatchNames.length; index += 1) {
      if (matchName === config.legacyMatchNames[index]) {
        return true;
      }
    }

    return false;
  }

  function isAdditionalMotionControl(property) {
    var currentProperty = property.parentProperty;

    while (currentProperty) {
      for (var index = 0; index < additionalMotionConfigs.length; index += 1) {
        try {
          if (
            isMotionEffectMatchName(
              additionalMotionConfigs[index],
              currentProperty.matchName
            )
          ) {
            return true;
          }
        } catch (error) {
          void error;
        }
      }

      currentProperty = currentProperty.parentProperty;
    }

    return false;
  }

  function getMotionSetup(property, config) {
    var expression = "";

    try {
      expression = property.expression || "";
    } catch (error) {
      void error;
      return null;
    }

    var firstLineEnd = expression.indexOf("\n");
    var firstLine = firstLineEnd === -1
      ? expression
      : expression.substring(0, firstLineEnd);

    if (firstLine.indexOf(config.expressionMarker) !== 0) {
      return null;
    }

    var effectName = firstLine.substring(config.expressionMarker.length);

    return effectName ? { effectName: effectName } : null;
  }

  function getMotionEffect(effects, config, effectName) {
    for (var index = 1; index <= effects.numProperties; index += 1) {
      try {
        var effect = effects.property(index);

        if (
          effect &&
          isMotionEffectMatchName(config, effect.matchName) &&
          (!effectName || effect.name === effectName)
        ) {
          return effect;
        }
      } catch (error) {
        void error;
      }
    }

    return null;
  }

  function isCompleteMotionEffect(effect, config) {
    if (!effect || effect.matchName !== config.matchName) {
      return false;
    }

    for (var index = 0; index < config.controlNames.length; index += 1) {
      try {
        var control = effect.property(index + 1);

        if (!control || control.name !== config.controlNames[index]) {
          return false;
        }
      } catch (error) {
        void error;
        return false;
      }
    }

    return true;
  }

  function getMotionEffectValues(effect, config) {
    var values = [];

    for (var index = 0; index < config.controlDefaults.length; index += 1) {
      try {
        var value = effect.property(index + 1).value;
        values.push(isFiniteNumber(value) ? value : config.controlDefaults[index]);
      } catch (error) {
        void error;
        values.push(config.controlDefaults[index]);
      }
    }

    return values;
  }

  function setMotionEffectValues(effect, config, values) {
    for (var index = 0; index < config.controlNames.length; index += 1) {
      var control = effect.property(index + 1);

      if (!control || control.name !== config.controlNames[index]) {
        throw new Error(
          "The " + config.effectName + " pseudo-effect is missing " +
          config.controlNames[index] + "."
        );
      }

      if (control.numKeys === 0) {
        control.setValue(values[index]);
      }
    }
  }

  function getMotionPresetFile(config) {
    var hostScriptFile = new File($.fileName);
    var extensionFolder = hostScriptFile.parent.parent;
    var presetFile = new File(
      extensionFolder.fsName + "/assets/" + config.presetName
    );

    if (!presetFile.exists) {
      throw new Error(
        "The bundled " + config.effectName + " pseudo-effect preset is missing."
      );
    }

    return presetFile;
  }

  function createMotionEffectName(effects, baseName) {
    if (!effectNameExists(effects, baseName)) {
      return baseName;
    }

    for (var suffix = 2; suffix < 1000; suffix += 1) {
      var name = baseName + " (" + suffix + ")";

      if (!effectNameExists(effects, name)) {
        return name;
      }
    }

    throw new Error("Could not create a unique " + baseName + " effect name.");
  }

  function addMotionEffect(layer, config, values) {
    var effects = layer.property("ADBE Effect Parade");
    var previousEffectCount = effects.numProperties;
    var effectName = createMotionEffectName(effects, config.effectName);

    applyPresetToOnlyLayer(layer, getMotionPresetFile(config));
    effects = layer.property("ADBE Effect Parade");

    for (
      var index = effects.numProperties;
      index > previousEffectCount;
      index -= 1
    ) {
      var effect = effects.property(index);

      if (effect && effect.matchName === config.matchName) {
        try {
          effect.name = effectName;
          setMotionEffectValues(effect, config, values);

          if (!isCompleteMotionEffect(effect, config)) {
            throw new Error(
              "The bundled " + config.effectName + " preset is incomplete."
            );
          }

          return effect;
        } catch (error) {
          try {
            effect.remove();
          } catch (removeError) {
            void removeError;
          }

          throw error;
        }
      }
    }

    throw new Error(
      "After Effects did not create the " + config.effectName + " pseudo-effect."
    );
  }

  function ensureMotionEffect(layer, config) {
    var effects = layer.property("ADBE Effect Parade");
    var currentEffect = null;
    var staleEffect = null;

    if (!effects) {
      throw new Error("The selected layer does not support effects.");
    }

    for (var index = 1; index <= effects.numProperties; index += 1) {
      var effect = effects.property(index);

      if (!effect || !isMotionEffectMatchName(config, effect.matchName)) {
        continue;
      }

      if (
        effect.matchName === config.matchName &&
        isCompleteMotionEffect(effect, config)
      ) {
        if (!currentEffect) {
          currentEffect = effect;
        }
      } else if (!staleEffect) {
        staleEffect = effect;
      }
    }

    if (currentEffect) {
      return {
        created: false,
        effect: currentEffect,
        staleEffectName: staleEffect ? staleEffect.name : null
      };
    }

    var values = staleEffect
      ? getMotionEffectValues(staleEffect, config)
      : config.controlDefaults;
    var staleEffectName = staleEffect ? staleEffect.name : null;
    var newEffect = addMotionEffect(layer, config, values);

    return {
      created: true,
      effect: newEffect,
      staleEffectName: staleEffectName
    };
  }

  function buildWiggleExpression(effectName) {
    return [
      wiggleMotionConfig.expressionMarker + effectName,
      "var __sqFx = effect(" + quoteExpressionString(effectName) + ");",
      "var __sqEnabled = __sqFx(1);",
      "var __sqFrequency = Math.max(0, __sqFx(2));",
      "var __sqAmount = __sqFx(3);",
      "var __sqIndividual = __sqFx(4);",
      "var __sqAxisAmounts = [__sqFx(5), __sqFx(6), __sqFx(7)];",
      "var __sqLockDimensions = __sqFx(8);",
      "var __sqSeed = Math.floor(__sqFx(9));",
      "var __sqFrameRate = Math.max(0, __sqFx(10));",
      "if (__sqFrameRate > 0) posterizeTime(__sqFrameRate);",
      "seedRandom(__sqSeed + index * 1009, true);",
      "if (__sqEnabled < 0.5 || __sqFrequency <= 0) {",
      "  value;",
      "} else {",
      "  var __sqIsArray = value instanceof Array;",
      "  var __sqDimensions = __sqIsArray ? value.length : 1;",
      "  if (__sqIndividual >= 0.5 && __sqIsArray) {",
      "    var __sqResult = [];",
      "    for (var __sqAxis = 0; __sqAxis < __sqDimensions; __sqAxis++) {",
      "      seedRandom(__sqSeed + index * 1009 + __sqAxis * 7919, true);",
      "      var __sqAxisWiggle = wiggle(__sqFrequency, __sqAxisAmounts[Math.min(__sqAxis, 2)]);",
      "      __sqResult[__sqAxis] = __sqAxisWiggle[__sqAxis];",
      "    }",
      "    __sqResult;",
      "  } else if (__sqLockDimensions >= 0.5 && __sqIsArray) {",
      "    var __sqLockedWiggle = wiggle(__sqFrequency, __sqAmount);",
      "    var __sqOffset = __sqLockedWiggle[0] - value[0];",
      "    var __sqLockedResult = [];",
      "    for (var __sqIndex = 0; __sqIndex < __sqDimensions; __sqIndex++) {",
      "      __sqLockedResult[__sqIndex] = value[__sqIndex] + __sqOffset;",
      "    }",
      "    __sqLockedResult;",
      "  } else {",
      "    wiggle(__sqFrequency, __sqAmount);",
      "  }",
      "}"
    ].join("\n");
  }

  function buildSpinExpression(effectName) {
    return [
      spinMotionConfig.expressionMarker + effectName,
      "var __sqFx = effect(" + quoteExpressionString(effectName) + ");",
      "var __sqEnabled = __sqFx(1);",
      "var __sqDirection = __sqFx(2) >= 0.5 ? -1 : 1;",
      "var __sqSpeed = __sqFx(3);",
      "var __sqFrameRate = Math.max(0, __sqFx(4));",
      "var __sqOffset = __sqFx(5);",
      "if (__sqFrameRate > 0) posterizeTime(__sqFrameRate);",
      "__sqEnabled < 0.5 ? value : value + __sqOffset + __sqDirection * __sqSpeed * (time - inPoint);"
    ].join("\n");
  }

  function buildBlinkerExpression(effectName) {
    return [
      blinkerMotionConfig.expressionMarker + effectName,
      "var __sqFx = effect(" + quoteExpressionString(effectName) + ");",
      "var __sqEnabled = __sqFx(1);",
      "var __sqSpeed = Math.max(0, __sqFx(2));",
      "var __sqFixed = __sqFx(3);",
      "var __sqRandomTiming = Math.min(100, Math.max(0, __sqFx(4))) / 100;",
      "var __sqHigh = Math.max(__sqFx(5), __sqFx(6));",
      "var __sqLow = Math.min(__sqFx(5), __sqFx(6));",
      "if (__sqEnabled < 0.5 || __sqSpeed <= 0) {",
      "  value;",
      "} else if (__sqFixed >= 0.5) {",
      "  var __sqStep = Math.max(0, Math.floor((time - inPoint) * __sqSpeed));",
      "  if (__sqRandomTiming > 0) {",
      "    seedRandom(index * 1009 + __sqStep, true);",
      "    __sqStep = Math.max(0, __sqStep - Math.floor(random(0, 1 + Math.round(__sqRandomTiming * 6))));",
      "  }",
      "  seedRandom(index + __sqStep, true);",
      "  random() < 0.5 ? __sqLow : __sqHigh;",
      "} else {",
      "  var __sqPhase = time * __sqSpeed * Math.PI * 2;",
      "  if (__sqRandomTiming > 0) {",
      "    seedRandom(index + Math.floor((time - inPoint) * __sqSpeed), true);",
      "    __sqPhase += random(-Math.PI, Math.PI) * __sqRandomTiming;",
      "  }",
      "  linear((Math.sin(__sqPhase) + 1) / 2, 0, 1, __sqLow, __sqHigh);",
      "}"
    ].join("\n");
  }

  function buildFaderExpression(effectName) {
    return [
      faderMotionConfig.expressionMarker + effectName,
      "var __sqFx = effect(" + quoteExpressionString(effectName) + ");",
      "var __sqEnabled = __sqFx(1);",
      "var __sqFrames = Math.max(0, __sqFx(2));",
      "var __sqLinear = __sqFx(3);",
      "var __sqDuration = __sqFrames * thisComp.frameDuration;",
      "if (__sqEnabled < 0.5 || __sqDuration <= 0) {",
      "  value;",
      "} else {",
      "  var __sqFadeInEnd = inPoint + __sqDuration;",
      "  var __sqFadeOutStart = outPoint - __sqDuration;",
      "  var __sqInValue = value;",
      "  var __sqOutValue = value;",
      "  if (time < __sqFadeInEnd) {",
      "    __sqInValue = __sqLinear >= 0.5 ? linear(time, inPoint, __sqFadeInEnd, 0, value) : ease(time, inPoint, __sqFadeInEnd, 0, value);",
      "  }",
      "  if (time > __sqFadeOutStart) {",
      "    __sqOutValue = __sqLinear >= 0.5 ? linear(time, __sqFadeOutStart, outPoint, value, 0) : ease(time, __sqFadeOutStart, outPoint, value, 0);",
      "  }",
      "  Math.min(__sqInValue, __sqOutValue);",
      "}"
    ].join("\n");
  }

  function pushUniqueMotionTarget(targets, property) {
    var layer = property.propertyGroup(property.propertyDepth);
    var path = getPropertyIndexPath(property);
    var pathKey = path.join(".");

    for (var index = 0; index < targets.length; index += 1) {
      if (targets[index].layer === layer && targets[index].pathKey === pathKey) {
        return;
      }
    }

    targets.push({
      layer: layer,
      name: sanitizeBounceLabel(property.name),
      path: path,
      pathKey: pathKey
    });
  }

  function getSelectedNumericMotionTargets(composition, predicate) {
    var selectedProperties = composition.selectedProperties;
    var targets = [];

    for (var index = 0; index < selectedProperties.length; index += 1) {
      var property = selectedProperties[index];

      try {
        if (
          property.propertyType !== PropertyType.PROPERTY ||
          property.canSetExpression !== true ||
          !isBounceValueType(property) ||
          isSequoiaBounceControl(property) ||
          isSequoiaOvershootControl(property) ||
          isAdditionalMotionControl(property) ||
          (predicate && !predicate(property))
        ) {
          continue;
        }

        pushUniqueMotionTarget(targets, property);
      } catch (error) {
        void error;
      }
    }

    return targets;
  }

  function isSpinProperty(property) {
    try {
      if (typeof property.value !== "number") {
        return false;
      }

      var matchName = String(property.matchName || "").toLowerCase();
      var name = String(property.name || "").toLowerCase();

      return (
        matchName.indexOf("rotate") !== -1 ||
        name.indexOf("rotation") !== -1 ||
        name.indexOf("angle") !== -1
      );
    } catch (error) {
      void error;
      return false;
    }
  }

  function getSelectedLayersWithPropertyTargets(composition, matchName) {
    var layers = composition.selectedLayers;
    var targets = [];

    for (var index = 0; index < layers.length; index += 1) {
      try {
        var transform = layers[index].property("ADBE Transform Group");
        var property = transform ? transform.property(matchName) : null;

        if (property && property.canSetExpression === true) {
          pushUniqueMotionTarget(targets, property);
        }
      } catch (error) {
        void error;
      }
    }

    return targets;
  }

  function getMotionRecord(records, layer, config) {
    for (var index = 0; index < records.length; index += 1) {
      if (records[index].layer === layer) {
        return records[index];
      }
    }

    var ensured = ensureMotionEffect(layer, config);
    var record = {
      created: ensured.created,
      effect: ensured.effect,
      layer: layer,
      staleEffectName: ensured.staleEffectName,
      successfulTargets: 0
    };
    records.push(record);

    return record;
  }

  function hasMotionExpressionReference(group, config, effectName) {
    if (!group) {
      return false;
    }

    try {
      if (group.canSetExpression === true) {
        var setup = getMotionSetup(group, config);

        if (setup && setup.effectName === effectName) {
          return true;
        }
      }
    } catch (error) {
      void error;
    }

    try {
      for (var index = 1; index <= group.numProperties; index += 1) {
        if (hasMotionExpressionReference(group.property(index), config, effectName)) {
          return true;
        }
      }
    } catch (error) {
      void error;
    }

    return false;
  }

  function rewriteMotionExpressionReferences(
    group,
    config,
    oldEffectName,
    newEffectName,
    expressionBuilder
  ) {
    if (!group) {
      return;
    }

    try {
      if (group.canSetExpression === true) {
        var setup = getMotionSetup(group, config);

        if (setup && setup.effectName === oldEffectName) {
          var wasEnabled = group.expressionEnabled === true;
          group.expression = expressionBuilder(newEffectName);
          group.expressionEnabled = wasEnabled;
        }
      }
    } catch (error) {
      void error;
    }

    try {
      for (var index = 1; index <= group.numProperties; index += 1) {
        rewriteMotionExpressionReferences(
          group.property(index),
          config,
          oldEffectName,
          newEffectName,
          expressionBuilder
        );
      }
    } catch (error) {
      void error;
    }
  }

  function cleanupMotionRecords(records, config, expressionBuilder) {
    for (var index = 0; index < records.length; index += 1) {
      var record = records[index];

      if (record.successfulTargets === 0 && record.created) {
        try {
          record.effect.remove();
        } catch (error) {
          void error;
        }
      }

      if (
        record.successfulTargets > 0 &&
        record.staleEffectName &&
        !hasMotionExpressionReference(
          record.layer,
          config,
          record.staleEffectName
        )
      ) {
        try {
          var effects = record.layer.property("ADBE Effect Parade");
          var newEffectName = record.effect.name;
          var staleEffect = getMotionEffect(
            effects,
            config,
            record.staleEffectName
          );

          if (staleEffect && staleEffect.name !== newEffectName) {
            staleEffect.remove();
          }

          effects = record.layer.property("ADBE Effect Parade");
          var currentEffect = getMotionEffect(
            effects,
            config,
            newEffectName
          );

          if (
            currentEffect &&
            !effectNameExists(effects, config.effectName)
          ) {
            currentEffect.name = config.effectName;
            rewriteMotionExpressionReferences(
              record.layer,
              config,
              newEffectName,
              currentEffect.name,
              expressionBuilder
            );
          }
        } catch (error) {
          void error;
        }
      }
    }
  }

  function applyMotionToTargets(config, targets, expressionBuilder) {
    if (targets.length === 0) {
      return "error|Select a supported property or layer first.";
    }

    var records = [];
    var changedProperties = 0;
    var unchangedProperties = 0;
    var errors = [];
    app.beginUndoGroup(config.undoName);

    try {
      for (var index = 0; index < targets.length; index += 1) {
        var target = targets[index];
        var property = resolvePropertyIndexPath(target.layer, target.path);

        if (!property || property.canSetExpression !== true) {
          errors.push(target.layer.name + " > " + target.name + ": the property is no longer available.");
          continue;
        }

        var previousExpression = property.expression || "";
        var previousExpressionEnabled = property.expressionEnabled === true;

        try {
          var record = getMotionRecord(records, target.layer, config);
          var expression = expressionBuilder(record.effect.name);

          if (
            previousExpression === expression &&
            previousExpressionEnabled
          ) {
            record.successfulTargets += 1;
            unchangedProperties += 1;
            continue;
          }

          property.expression = expression;
          property.expressionEnabled = true;

          if (property.expressionError) {
            throw new Error(property.expressionError);
          }

          record.successfulTargets += 1;
          changedProperties += 1;
        } catch (error) {
          restorePropertyExpression(
            target.layer,
            target.path,
            previousExpression,
            previousExpressionEnabled
          );
          errors.push(
            target.layer.name + " > " + target.name + ": " +
            (error && error.toString ? error.toString() : "Unknown error.")
          );
        }
      }

      cleanupMotionRecords(records, config, expressionBuilder);
    } finally {
      app.endUndoGroup();
    }

    if (changedProperties > 0 && errors.length === 0) {
      return "ok|" + changedProperties;
    }

    if (changedProperties > 0) {
      return "partial|" + changedProperties + "|" + errors.join("\n");
    }

    if (unchangedProperties > 0 && errors.length === 0) {
      return "noop|" + unchangedProperties;
    }

    return "error|" + (
      errors.length > 0
        ? errors.join("\n")
        : config.effectName + " could not be applied."
    );
  }

  function getSelectedLayerList(composition) {
    var layers = [];
    var selectedLayers = composition.selectedLayers;
    var selectedProperties = composition.selectedProperties;

    function pushLayer(layer) {
      for (var index = 0; index < layers.length; index += 1) {
        if (layers[index] === layer) {
          return;
        }
      }

      layers.push(layer);
    }

    for (var layerIndex = 0; layerIndex < selectedLayers.length; layerIndex += 1) {
      pushLayer(selectedLayers[layerIndex]);
    }

    for (
      var propertyIndex = 0;
      propertyIndex < selectedProperties.length;
      propertyIndex += 1
    ) {
      try {
        var property = selectedProperties[propertyIndex];
        pushLayer(property.propertyGroup(property.propertyDepth));
      } catch (error) {
        void error;
      }
    }

    return layers;
  }

  function hasSelectedMotionProperties(config) {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "0";
    }

    var selectedProperties = composition.selectedProperties;

    for (var index = 0; index < selectedProperties.length; index += 1) {
      if (getMotionSetup(selectedProperties[index], config)) {
        return "1";
      }
    }

    var layers = getSelectedLayerList(composition);

    for (var layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      try {
        var effects = layers[layerIndex].property("ADBE Effect Parade");

        if (effects && getMotionEffect(effects, config, null)) {
          return "1";
        }
      } catch (error) {
        void error;
      }
    }

    return "0";
  }

  function clearMotionExpressions(group, config) {
    var cleared = 0;

    if (!group) {
      return cleared;
    }

    try {
      if (
        group.canSetExpression === true &&
        getMotionSetup(group, config)
      ) {
        group.expression = "";
        cleared += 1;
      }
    } catch (error) {
      void error;
    }

    try {
      for (var index = 1; index <= group.numProperties; index += 1) {
        cleared += clearMotionExpressions(group.property(index), config);
      }
    } catch (error) {
      void error;
    }

    return cleared;
  }

  function removeSelectedMotion(config) {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before removing " + config.effectName + ".";
    }

    var layers = getSelectedLayerList(composition);

    if (layers.length === 0) {
      return "error|Select at least one layer with " + config.effectName + ".";
    }

    var removed = 0;
    var errors = [];
    app.beginUndoGroup("Remove " + config.effectName);

    try {
      for (var layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        var layer = layers[layerIndex];

        try {
          var clearedExpressions = clearMotionExpressions(layer, config);
          var effects = layer.property("ADBE Effect Parade");
          var removedEffects = 0;

          if (effects) {
            for (var index = effects.numProperties; index >= 1; index -= 1) {
              var effect = effects.property(index);

              if (
                effect &&
                isMotionEffectMatchName(config, effect.matchName)
              ) {
                effect.remove();
                removedEffects += 1;
              }
            }
          }

          if (clearedExpressions > 0 || removedEffects > 0) {
            removed += 1;
          }
        } catch (error) {
          errors.push(
            layer.name + ": " +
            (error && error.toString ? error.toString() : "Unknown error.")
          );
        }
      }
    } finally {
      app.endUndoGroup();
    }

    if (removed > 0 && errors.length === 0) {
      return "ok|" + removed;
    }

    if (removed > 0) {
      return "partial|" + removed + "|" + errors.join("\n");
    }

    return "error|" + (
      errors.length > 0
        ? errors.join("\n")
        : config.effectName + " was not found on the selected layers."
    );
  }

  Sequoia.convertSelectedKeyframes = function (mode) {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "0";
    }

    var interpolationType;
    var useAutoBezier = mode === "autoBezier";

    if (mode === "linear") {
      interpolationType = KeyframeInterpolationType.LINEAR;
    } else if (mode === "hold") {
      interpolationType = KeyframeInterpolationType.HOLD;
    } else if (useAutoBezier) {
      interpolationType = KeyframeInterpolationType.BEZIER;
    } else {
      return "0";
    }

    var properties = getSelectedKeyframeProperties(composition);
    var changedKeys = 0;

    if (properties.length === 0) {
      return "0";
    }

    app.beginUndoGroup("Convert Selected Keyframes");

    try {
      for (
        var propertyIndex = 0;
        propertyIndex < properties.length;
        propertyIndex += 1
      ) {
        var property = properties[propertyIndex];

        try {
          if (!property.isInterpolationTypeValid(interpolationType)) {
            continue;
          }
        } catch (error) {
          void error;
          continue;
        }

        var selectedKeys = property.selectedKeys;

        for (var keyIndex = 0; keyIndex < selectedKeys.length; keyIndex += 1) {
          try {
            var key = selectedKeys[keyIndex];
            property.setInterpolationTypeAtKey(
              key,
              interpolationType,
              interpolationType
            );
            property.setTemporalContinuousAtKey(key, useAutoBezier);
            property.setTemporalAutoBezierAtKey(key, useAutoBezier);
            changedKeys += 1;
          } catch (error) {
            void error;
          }
        }
      }
    } finally {
      app.endUndoGroup();
    }

    return changedKeys.toString();
  };

  Sequoia.applyEasing = function (x1, y1, x2, y2) {
    var composition = app.project.activeItem;

    if (
      !(composition instanceof CompItem) ||
      !isFiniteNumber(x1) ||
      !isFiniteNumber(y1) ||
      !isFiniteNumber(x2) ||
      !isFiniteNumber(y2)
    ) {
      return "0";
    }

    x1 = clamp(x1, 0, 1);
    y1 = clamp(y1, 0, 1);
    x2 = clamp(x2, 0, 1);
    y2 = clamp(y2, 0, 1);

    var outInfluence = clamp(
      x1 * 100,
      minimumEaseInfluence,
      100
    );
    var inInfluence = clamp(
      (1 - x2) * 100,
      minimumEaseInfluence,
      100
    );
    var outSpeedFactor = getStartSpeedFactor(x1, y1, x2, y2);
    var inSpeedFactor = getEndSpeedFactor(x1, y1, x2, y2);
    var properties = getSelectedKeyframeProperties(composition);
    var changedSegments = 0;

    if (properties.length === 0) {
      return "0";
    }

    app.beginUndoGroup("Apply Easing");

    try {
      for (
        var propertyIndex = 0;
        propertyIndex < properties.length;
        propertyIndex += 1
      ) {
        var property = properties[propertyIndex];

        try {
          if (!property.isInterpolationTypeValid(KeyframeInterpolationType.BEZIER)) {
            continue;
          }
        } catch (error) {
          void error;
          continue;
        }

        var selectedKeys = property.selectedKeys;

        for (
          var selectedIndex = 0;
          selectedIndex < selectedKeys.length - 1;
          selectedIndex += 1
        ) {
          var startKey = selectedKeys[selectedIndex];
          var endKey = selectedKeys[selectedIndex + 1];

          if (endKey !== startKey + 1) {
            continue;
          }

          try {
            if (
              applyEasingToPair(
                property,
                startKey,
                endKey,
                outSpeedFactor,
                outInfluence,
                inSpeedFactor,
                inInfluence
              )
            ) {
              changedSegments += 1;
            }
          } catch (error) {
            void error;
          }
        }
      }
    } finally {
      app.endUndoGroup();
    }

    return changedSegments.toString();
  };

  Sequoia.hasSelectedBounceProperties = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "0";
    }

    return getSelectedBouncePropertyTargets(composition).length > 0
      ? "1"
      : "0";
  };

  Sequoia.removeSelectedBounce = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before removing Bounce.";
    }

    var targets = getSelectedBouncePropertyTargets(composition);

    if (targets.length === 0) {
      return "error|Select at least one property with Bounce applied.";
    }

    var removedProperties = 0;
    var errors = [];
    app.beginUndoGroup("Remove Bounce");

    try {
      for (var index = 0; index < targets.length; index += 1) {
        var target = targets[index];

        try {
          if (removeBounceFromProperty(target)) {
            removedProperties += 1;
          }
        } catch (error) {
          errors.push(
            describeBounceTarget(target) +
            ": " +
            (error && error.toString ? error.toString() : "Unknown error.")
          );
        }
      }
    } finally {
      app.endUndoGroup();
    }

    if (removedProperties > 0 && errors.length === 0) {
      return "ok|" + removedProperties;
    }

    if (removedProperties > 0) {
      return "partial|" + removedProperties + "|" + errors.join("\n");
    }

    return "error|" + (
      errors.length > 0
        ? errors.join("\n")
        : "Bounce could not be removed."
    );
  };

  Sequoia.applyBounce = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before applying Bounce.";
    }

    var selectedProperties = composition.selectedProperties;
    var targets = [];
    var errors = [];
    var selectedValueProperties = 0;
    var unchangedProperties = 0;

    for (var index = 0; index < selectedProperties.length; index += 1) {
      var property = selectedProperties[index];

      try {
        if (property.propertyType !== PropertyType.PROPERTY) {
          continue;
        }

        selectedValueProperties += 1;

        var layer = property.propertyGroup(property.propertyDepth);
        var propertyName = sanitizeBounceLabel(property.name);
        var targetDescription = layer.name + " > " + propertyName;

        if (
          isSequoiaBounceControl(property) ||
          isSequoiaOvershootControl(property)
        ) {
          errors.push(targetDescription + ": select the animated property, not a motion effect control.");
          continue;
        }

        if (property.numKeys < 2) {
          errors.push(targetDescription + ": at least two keyframes are required.");
          continue;
        }

        if (!isBounceValueType(property)) {
          errors.push(targetDescription + ": this property type is not supported.");
          continue;
        }

        if (property.canSetExpression !== true) {
          errors.push(targetDescription + ": expressions are not supported.");
          continue;
        }

        var previousValue = getNumberComponents(
          property.keyValue(property.numKeys - 1)
        );
        var finalValue = getNumberComponents(property.keyValue(property.numKeys));

        if (
          !previousValue ||
          !finalValue ||
          previousValue.length !== finalValue.length
        ) {
          errors.push(targetDescription + ": the final keyframe values are incompatible.");
          continue;
        }

        var effects = layer.property("ADBE Effect Parade");

        if (!effects) {
          errors.push(targetDescription + ": the layer does not support effects.");
          continue;
        }

        var existingSetup = readBounceSetup(property);
        var existingEffect = existingSetup && existingSetup.effectName
          ? getBounceEffect(effects, existingSetup.effectName)
          : null;

        if (isCompleteBounceEffect(existingEffect)) {
          unchangedProperties += 1;
          continue;
        }

        targets.push({
          layer: layer,
          name: propertyName,
          path: getPropertyIndexPath(property)
        });
      } catch (error) {
        errors.push(
          (property && property.name ? property.name : "Selected property") +
          ": " +
          (error && error.toString ? error.toString() : "Unknown error.")
        );
      }
    }

    if (targets.length === 0) {
      if (unchangedProperties > 0 && errors.length === 0) {
        return "noop|" + unchangedProperties;
      }

      if (errors.length > 0) {
        return "error|" + errors.join("\n");
      }

      return "error|" + (
        selectedValueProperties > 0
          ? "No selected property can use Bounce."
          : "Select at least one animated numeric property with two or more keyframes."
      );
    }

    var appliedProperties = 0;
    app.beginUndoGroup("Apply Bounce");

    try {
      for (var targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
        var target = targets[targetIndex];

        try {
          if (applyBounceToProperty(target)) {
            appliedProperties += 1;
          } else {
            unchangedProperties += 1;
          }
        } catch (error) {
          errors.push(
            describeBounceTarget(target) +
            ": " +
            (error && error.toString ? error.toString() : "Unknown error.")
          );
        }
      }
    } finally {
      app.endUndoGroup();
    }

    if (appliedProperties > 0 && errors.length === 0) {
      return "ok|" + appliedProperties;
    }

    if (appliedProperties > 0) {
      return "partial|" + appliedProperties + "|" + errors.join("\n");
    }

    if (unchangedProperties > 0 && errors.length === 0) {
      return "noop|" + unchangedProperties;
    }

    return "error|" + (
      errors.length > 0
        ? errors.join("\n")
        : "Bounce could not be applied."
    );
  };

  Sequoia.hasSelectedOvershootProperties = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "0";
    }

    return getSelectedOvershootPropertyTargets(composition).length > 0
      ? "1"
      : "0";
  };

  Sequoia.removeSelectedOvershoot = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before removing Overshoot.";
    }

    var targets = getSelectedOvershootPropertyTargets(composition);

    if (targets.length === 0) {
      return "error|Select at least one property with Overshoot applied.";
    }

    var removedProperties = 0;
    var errors = [];
    app.beginUndoGroup("Remove Overshoot");

    try {
      for (var index = 0; index < targets.length; index += 1) {
        var target = targets[index];

        try {
          if (removeOvershootFromProperty(target)) {
            removedProperties += 1;
          }
        } catch (error) {
          errors.push(
            describeBounceTarget(target) +
            ": " +
            (error && error.toString ? error.toString() : "Unknown error.")
          );
        }
      }
    } finally {
      app.endUndoGroup();
    }

    if (removedProperties > 0 && errors.length === 0) {
      return "ok|" + removedProperties;
    }

    if (removedProperties > 0) {
      return "partial|" + removedProperties + "|" + errors.join("\n");
    }

    return "error|" + (
      errors.length > 0
        ? errors.join("\n")
        : "Overshoot could not be removed."
    );
  };

  Sequoia.applyOvershoot = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before applying Overshoot.";
    }

    var selectedProperties = composition.selectedProperties;
    var targets = [];
    var errors = [];
    var selectedValueProperties = 0;
    var unchangedProperties = 0;

    for (var index = 0; index < selectedProperties.length; index += 1) {
      var property = selectedProperties[index];

      try {
        if (property.propertyType !== PropertyType.PROPERTY) {
          continue;
        }

        selectedValueProperties += 1;

        var layer = property.propertyGroup(property.propertyDepth);
        var propertyName = sanitizeBounceLabel(property.name);
        var targetDescription = layer.name + " > " + propertyName;

        if (
          isSequoiaBounceControl(property) ||
          isSequoiaOvershootControl(property)
        ) {
          errors.push(targetDescription + ": select the animated property, not a motion effect control.");
          continue;
        }

        if (property.numKeys < 2) {
          errors.push(targetDescription + ": at least two keyframes are required.");
          continue;
        }

        if (!isBounceValueType(property)) {
          errors.push(targetDescription + ": this property type is not supported.");
          continue;
        }

        if (property.canSetExpression !== true) {
          errors.push(targetDescription + ": expressions are not supported.");
          continue;
        }

        var previousValue = getNumberComponents(
          property.keyValue(property.numKeys - 1)
        );
        var finalValue = getNumberComponents(property.keyValue(property.numKeys));

        if (
          !previousValue ||
          !finalValue ||
          previousValue.length !== finalValue.length
        ) {
          errors.push(targetDescription + ": the final keyframe values are incompatible.");
          continue;
        }

        var effects = layer.property("ADBE Effect Parade");

        if (!effects) {
          errors.push(targetDescription + ": the layer does not support effects.");
          continue;
        }

        var existingSetup = readOvershootSetup(property);
        var existingEffect = existingSetup
          ? getOvershootEffect(effects, existingSetup.effectName)
          : null;

        if (isCompleteOvershootEffect(existingEffect)) {
          unchangedProperties += 1;
          continue;
        }

        targets.push({
          layer: layer,
          name: propertyName,
          path: getPropertyIndexPath(property)
        });
      } catch (error) {
        errors.push(
          (property && property.name ? property.name : "Selected property") +
          ": " +
          (error && error.toString ? error.toString() : "Unknown error.")
        );
      }
    }

    if (targets.length === 0) {
      if (unchangedProperties > 0 && errors.length === 0) {
        return "noop|" + unchangedProperties;
      }

      if (errors.length > 0) {
        return "error|" + errors.join("\n");
      }

      return "error|" + (
        selectedValueProperties > 0
          ? "No selected property can use Overshoot."
          : "Select at least one animated numeric property with two or more keyframes."
      );
    }

    var appliedProperties = 0;
    app.beginUndoGroup("Apply Overshoot");

    try {
      for (var targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
        var target = targets[targetIndex];

        try {
          if (applyOvershootToProperty(target)) {
            appliedProperties += 1;
          } else {
            unchangedProperties += 1;
          }
        } catch (error) {
          errors.push(
            describeBounceTarget(target) +
            ": " +
            (error && error.toString ? error.toString() : "Unknown error.")
          );
        }
      }
    } finally {
      app.endUndoGroup();
    }

    if (appliedProperties > 0 && errors.length === 0) {
      return "ok|" + appliedProperties;
    }

    if (appliedProperties > 0) {
      return "partial|" + appliedProperties + "|" + errors.join("\n");
    }

    if (unchangedProperties > 0 && errors.length === 0) {
      return "noop|" + unchangedProperties;
    }

    return "error|" + (
      errors.length > 0
        ? errors.join("\n")
        : "Overshoot could not be applied."
    );
  };

  Sequoia.hasSelectedWiggleProperties = function () {
    return hasSelectedMotionProperties(wiggleMotionConfig);
  };

  Sequoia.removeSelectedWiggle = function () {
    return removeSelectedMotion(wiggleMotionConfig);
  };

  Sequoia.applyWiggle = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before applying Wiggle.";
    }

    return applyMotionToTargets(
      wiggleMotionConfig,
      getSelectedNumericMotionTargets(composition, null),
      buildWiggleExpression
    );
  };

  Sequoia.hasSelectedSpinProperties = function () {
    return hasSelectedMotionProperties(spinMotionConfig);
  };

  Sequoia.removeSelectedSpin = function () {
    return removeSelectedMotion(spinMotionConfig);
  };

  Sequoia.applySpin = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before applying Spin.";
    }

    var targets = getSelectedNumericMotionTargets(
      composition,
      isSpinProperty
    );

    if (targets.length === 0) {
      targets = getSelectedLayersWithPropertyTargets(
        composition,
        "ADBE Rotate Z"
      );
    }

    return applyMotionToTargets(
      spinMotionConfig,
      targets,
      buildSpinExpression
    );
  };

  Sequoia.hasSelectedBlinkerProperties = function () {
    return hasSelectedMotionProperties(blinkerMotionConfig);
  };

  Sequoia.removeSelectedBlinker = function () {
    return removeSelectedMotion(blinkerMotionConfig);
  };

  Sequoia.applyBlinker = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before applying Blinker / Flicker.";
    }

    return applyMotionToTargets(
      blinkerMotionConfig,
      getSelectedLayersWithPropertyTargets(composition, "ADBE Opacity"),
      buildBlinkerExpression
    );
  };

  Sequoia.hasSelectedFaderProperties = function () {
    return hasSelectedMotionProperties(faderMotionConfig);
  };

  Sequoia.removeSelectedFader = function () {
    return removeSelectedMotion(faderMotionConfig);
  };

  Sequoia.applyFader = function () {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before applying Fader.";
    }

    return applyMotionToTargets(
      faderMotionConfig,
      getSelectedLayersWithPropertyTargets(composition, "ADBE Opacity"),
      buildFaderExpression
    );
  };

  Sequoia.setAnchorPoint = function (horizontal, vertical) {
    var composition = app.project.activeItem;

    if (!(composition instanceof CompItem)) {
      return "error|Open a composition before setting Anchor Point.";
    }

    var layers = composition.selectedLayers;

    if (!layers || layers.length === 0) {
      return "error|Select at least one layer.";
    }

    var changedLayers = 0;
    var errors = [];
    app.beginUndoGroup("Set Anchor Point");

    try {
      for (var index = 0; index < layers.length; index += 1) {
        lastAnchorPointError = "";

        try {
          if (setLayerAnchorPoint(layers[index], horizontal, vertical, composition.time)) {
            changedLayers += 1;
          } else if (lastAnchorPointError) {
            errors.push(layers[index].name + ": " + lastAnchorPointError);
          }
        } catch (error) {
          errors.push(
            layers[index].name + ": " +
            (error && error.toString ? error.toString() : "Unknown error.")
          );
        }
      }
    } finally {
      app.endUndoGroup();
    }

    if (changedLayers > 0) {
      return changedLayers.toString();
    }

    return "error|" + (
      errors.length > 0
        ? errors.join("\n")
        : "No selected layer could be changed."
    );
  };

  global.Sequoia = Sequoia;
})($.global);

(function () {
  var hostFile = new File($.fileName);
  var toolFiles = ["easing-tools.jsx", "keyframe-tools.jsx"];

  for (var index = 0; index < toolFiles.length; index += 1) {
    var toolFile = new File(hostFile.parent.fsName + "/" + toolFiles[index]);

    if (toolFile.exists) {
      $.evalFile(toolFile);
    }
  }
})();
