/* oxlint-disable no-unused-vars -- ExtendScript requires a catch binding. */
(function (global) {
  var Sequoia = global.Sequoia || {};
  var shared = global.SequoiaShared;
  var applyPresetToOnlyLayer = shared.applyPresetToOnlyLayer;
  var describeError = shared.describeError;
  var getActiveComposition = shared.getActiveComposition;
  var getSelectedLayerList = shared.getSelectedLayerList;
  var pushUniqueLayer = shared.pushUniqueLayer;
  var resultError = shared.resultError;
  var resultPartial = shared.resultPartial;
  var resultSuccess = shared.resultSuccess;
  var SHAPE_ROOT = "ADBE Root Vectors Group";
  var SHAPE_CONTENTS = "ADBE Vectors Group";
  var VECTOR_TRANSFORM = "ADBE Vector Transform Group";
  var COLOR_CONTROLS_EFFECT_NAME = "Color Controls";
  var COLOR_CONTROLS_MATCH_NAME_PREFIX = "Pseudo/SQ Color Controls ";
  var COLOR_CONTROLS_MAX_COLORS = 16;

  function reasonMessage(reason) {
    if (reason === "noSelection") {
      return "Open a composition and select the required layers or properties.";
    }

    if (reason === "unsupportedLayer") {
      return "The selection does not contain a supported layer.";
    }

    if (reason === "nothingToExtract") {
      return "No supported shape, path, or color property was found.";
    }

    if (reason === "tooManyColors") {
      return "Color Controls supports up to 16 unique colors per palette.";
    }

    if (reason === "missingPseudoEffect") {
      return "The bundled Sequoia Color Controls pseudo-effect could not be created.";
    }

    return "After Effects could not complete the operation.";
  }

  function formatResult(result) {
    return shared.formatResult(result, reasonMessage);
  }

  function getSelectedTransformLayers(composition) {
    var layers = getSelectedLayerList(composition);
    var result = [];

    for (var index = 0; index < layers.length; index += 1) {
      try {
        var transform = layers[index].property("ADBE Transform Group");

        if (transform && transform.property("ADBE Scale")) {
          result.push(layers[index]);
        }
      } catch (error) {
        void error;
      }
    }

    return result;
  }

  function copyArray(value) {
    var result = [];

    if (!value || typeof value.length !== "number") {
      return result;
    }

    for (var index = 0; index < value.length; index += 1) {
      result.push(value[index]);
    }

    return result;
  }

  function getLayerScaleValue(layer) {
    try {
      var transform = layer.property("ADBE Transform Group");
      var scale = transform ? transform.property("ADBE Scale") : null;
      return scale ? copyArray(scale.value) : null;
    } catch (error) {
      return null;
    }
  }

  function setLayerScaleValue(layer, value, time) {
    try {
      var transform = layer.property("ADBE Transform Group");
      var scale = transform ? transform.property("ADBE Scale") : null;

      if (!scale) {
        return false;
      }

      if (scale.numKeys > 0) {
        scale.setValueAtTime(time, value);
      } else {
        scale.setValue(value);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  function flipSelectedLayers(axis) {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    var layers = getSelectedTransformLayers(composition);

    if (layers.length === 0) {
      return resultError("noSelection");
    }

    var changed = 0;
    var errors = [];
    app.beginUndoGroup(
      axis === "horizontal"
        ? "Flip Layers Horizontal"
        : "Flip Layers Vertical"
    );

    try {
      for (var index = 0; index < layers.length; index += 1) {
        var scale = getLayerScaleValue(layers[index]);

        if (!scale || scale.length < 2) {
          errors.push(layers[index].name + ": Scale is not editable.");
          continue;
        }

        if (axis === "horizontal") {
          scale[0] = -scale[0];
        } else {
          scale[1] = -scale[1];
        }

        if (setLayerScaleValue(layers[index], scale, composition.time)) {
          changed += 1;
        } else {
          errors.push(layers[index].name + ": After Effects rejected Scale.");
        }
      }
    } finally {
      app.endUndoGroup();
    }

    if (changed > 0 && errors.length > 0) {
      return resultPartial(changed, errors.join("\n"));
    }

    return changed > 0
      ? resultSuccess(changed)
      : resultError("operationFailed", errors.join("\n"));
  }

  function getLayerFitSize(layer, time) {
    try {
      if (layer.sourceRectAtTime) {
        var bounds = layer.sourceRectAtTime(time, true);

        if (bounds && bounds.width > 0 && bounds.height > 0) {
          return { width: bounds.width, height: bounds.height };
        }
      }
    } catch (error) {
      void error;
    }

    try {
      if (layer.width > 0 && layer.height > 0) {
        return { width: layer.width, height: layer.height };
      }
    } catch (error) {
      void error;
    }

    return null;
  }

  function fitSelectedLayers(dimension) {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    var layers = getSelectedTransformLayers(composition);

    if (layers.length === 0) {
      return resultError("noSelection");
    }

    var changed = 0;
    var errors = [];
    app.beginUndoGroup(
      dimension === "width"
        ? "Fit Layers to Comp Width"
        : "Fit Layers to Comp Height"
    );

    try {
      for (var index = 0; index < layers.length; index += 1) {
        var size = getLayerFitSize(layers[index], composition.time);
        var scale = getLayerScaleValue(layers[index]);

        if (!size || !scale || scale.length < 2) {
          errors.push(layers[index].name + ": Layer bounds are unavailable.");
          continue;
        }

        var sourceSize = dimension === "width" ? size.width : size.height;
        var targetSize = dimension === "width"
          ? composition.width
          : composition.height;

        if (sourceSize <= 0 || targetSize <= 0) {
          errors.push(layers[index].name + ": Layer bounds are empty.");
          continue;
        }

        var nextScale = targetSize / sourceSize * 100;
        scale[0] = nextScale * (scale[0] < 0 ? -1 : 1);
        scale[1] = nextScale * (scale[1] < 0 ? -1 : 1);

        if (setLayerScaleValue(layers[index], scale, composition.time)) {
          changed += 1;
        } else {
          errors.push(layers[index].name + ": After Effects rejected Scale.");
        }
      }
    } finally {
      app.endUndoGroup();
    }

    if (changed > 0 && errors.length > 0) {
      return resultPartial(changed, errors.join("\n"));
    }

    return changed > 0
      ? resultSuccess(changed)
      : resultError("operationFailed", errors.join("\n"));
  }

  function getShapeRoot(layer) {
    if (!layer || !layer.property) {
      return null;
    }

    try {
      return layer.property(SHAPE_ROOT);
    } catch (error) {
      return null;
    }
  }

  function isContentContainer(property) {
    return property && (
      property.matchName === SHAPE_ROOT ||
      property.matchName === SHAPE_CONTENTS
    );
  }

  function isRemovableContentItem(property) {
    try {
      return property &&
        property.propertyGroup &&
        isContentContainer(property.propertyGroup(1));
    } catch (error) {
      return false;
    }
  }

  function isMergeableShapeItem(property) {
    if (!property) {
      return false;
    }

    try {
      return property.matchName === "ADBE Vector Group" ||
        property.matchName === "ADBE Vector Shape - Group" ||
        property.matchName === "ADBE Vector Shape";
    } catch (error) {
      return false;
    }
  }

  function sameProperty(first, second) {
    try {
      if (first === second) {
        return true;
      }
    } catch (error) {
      void error;
    }

    try {
      if (
        typeof first.propertyDepth !== "number" ||
        typeof second.propertyDepth !== "number" ||
        first.matchName !== second.matchName ||
        first.propertyIndex !== second.propertyIndex ||
        first.propertyDepth !== second.propertyDepth
      ) {
        return false;
      }

      var firstLayer = first.propertyGroup(first.propertyDepth);
      var secondLayer = second.propertyGroup(second.propertyDepth);

      if (!firstLayer || !secondLayer) {
        return false;
      }

      if (
        typeof firstLayer.id === "number" &&
        typeof secondLayer.id === "number"
      ) {
        return firstLayer.id === secondLayer.id;
      }

      if (firstLayer.index !== secondLayer.index) {
        return false;
      }

      var firstComp = firstLayer.containingComp;
      var secondComp = secondLayer.containingComp;

      if (
        firstComp &&
        secondComp &&
        typeof firstComp.id === "number" &&
        typeof secondComp.id === "number"
      ) {
        return firstComp.id === secondComp.id;
      }

      return firstComp === secondComp;
    } catch (error) {
      return false;
    }
  }

  function getPathFromRoot(property, root) {
    var path = [];
    var current = property;

    while (current) {
      var parent = null;

      try {
        parent = current.propertyGroup(1);
      } catch (error) {
        return null;
      }

      if (!parent) {
        return null;
      }

      path.unshift(current.propertyIndex);

      if (sameProperty(parent, root)) {
        return path;
      }

      current = parent;
    }

    return null;
  }

  function getSelectedContentPath(property, root) {
    var current = property;

    while (current) {
      if (isRemovableContentItem(current)) {
        if (current.matchName !== "ADBE Vector Group") {
          try {
            var parent = current.propertyGroup(1);

            while (parent && !sameProperty(parent, root)) {
              if (
                parent.matchName === "ADBE Vector Group" &&
                isRemovableContentItem(parent)
              ) {
                return getPathFromRoot(parent, root);
              }

              parent = parent.propertyGroup(1);
            }
          } catch (error) {
            void error;
          }
        }

        return isMergeableShapeItem(current)
          ? getPathFromRoot(current, root)
          : null;
      }

      try {
        current = current.propertyGroup(1);
      } catch (error) {
        return null;
      }

      if (sameProperty(current, root)) {
        return null;
      }
    }

    return null;
  }

  function isPrefixPath(prefix, path) {
    if (prefix.length > path.length) {
      return false;
    }

    for (var index = 0; index < prefix.length; index += 1) {
      if (prefix[index] !== path[index]) {
        return false;
      }
    }

    return true;
  }

  function deduplicatePaths(paths) {
    var result = [];

    for (var index = 0; index < paths.length; index += 1) {
      var path = paths[index];
      var skip = false;

      for (var resultIndex = 0; resultIndex < result.length; resultIndex += 1) {
        if (isPrefixPath(result[resultIndex], path)) {
          skip = true;
          break;
        }

        if (isPrefixPath(path, result[resultIndex])) {
          result.splice(resultIndex, 1);
          resultIndex -= 1;
        }
      }

      if (!skip) {
        result.push(path);
      }
    }

    return result;
  }

  function getSelectedShapePaths(composition, layer) {
    var root = getShapeRoot(layer);

    if (!root) {
      return [];
    }

    var selectedProperties = composition.selectedProperties || [];
    var paths = [];

    for (var index = 0; index < selectedProperties.length; index += 1) {
      var path = getSelectedContentPath(selectedProperties[index], root);

      if (path && path.length > 0) {
        paths.push(path);
      }
    }

    return deduplicatePaths(paths);
  }

  function getTopLevelShapePaths(layer) {
    var root = getShapeRoot(layer);
    var paths = [];

    if (!root) {
      return paths;
    }

    for (var index = 1; index <= root.numProperties; index += 1) {
      var child = root.property(index);

      if (isRemovableContentItem(child) && isMergeableShapeItem(child)) {
        paths.push([index]);
      }
    }

    return paths;
  }

  function pathsForIndex(paths, index) {
    var result = [];

    for (var pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
      if (paths[pathIndex].length > 0 && paths[pathIndex][0] === index) {
        result.push(paths[pathIndex].slice(1));
      }
    }

    return result;
  }

  function hasEmptyPath(paths) {
    for (var index = 0; index < paths.length; index += 1) {
      if (paths[index].length === 0) {
        return true;
      }
    }

    return false;
  }

  function removeProperty(property) {
    try {
      property.remove();
      return true;
    } catch (error) {
      return false;
    }
  }

  function pruneToPaths(group, paths) {
    if (!group || !paths || paths.length === 0 || hasEmptyPath(paths)) {
      return;
    }

    if (isContentContainer(group)) {
      for (var index = group.numProperties; index >= 1; index -= 1) {
        var childPaths = pathsForIndex(paths, index);
        var child = group.property(index);

        if (childPaths.length === 0) {
          removeProperty(child);
        } else {
          pruneToPaths(child, childPaths);
        }
      }

      return;
    }

    for (var propertyIndex = group.numProperties; propertyIndex >= 1; propertyIndex -= 1) {
      var nestedPaths = pathsForIndex(paths, propertyIndex);

      if (nestedPaths.length > 0) {
        pruneToPaths(group.property(propertyIndex), nestedPaths);
      }
    }
  }

  function removePaths(group, paths) {
    if (!group || !paths || paths.length === 0) {
      return;
    }

    if (isContentContainer(group)) {
      for (var index = group.numProperties; index >= 1; index -= 1) {
        var childPaths = pathsForIndex(paths, index);

        if (childPaths.length === 0) {
          continue;
        }

        var child = group.property(index);

        if (hasEmptyPath(childPaths)) {
          removeProperty(child);
        } else {
          removePaths(child, childPaths);
        }
      }

      return;
    }

    for (var propertyIndex = group.numProperties; propertyIndex >= 1; propertyIndex -= 1) {
      var nestedPaths = pathsForIndex(paths, propertyIndex);

      if (nestedPaths.length > 0) {
        removePaths(group.property(propertyIndex), nestedPaths);
      }
    }
  }

  function getNameForPath(layer, path) {
    var property = getShapeRoot(layer);

    for (var index = 0; index < path.length; index += 1) {
      if (!property || !property.property) {
        break;
      }

      property = property.property(path[index]);
    }

    return property && property.name
      ? property.name
      : layer.name + " Shape";
  }

  function duplicateLayerWithPaths(layer, paths, name) {
    var duplicate = layer.duplicate();
    duplicate.name = name;
    pruneToPaths(getShapeRoot(duplicate), paths);
    return duplicate;
  }

  function selectOnlyLayers(composition, layers) {
    try {
      for (var index = 1; index <= composition.numLayers; index += 1) {
        composition.layer(index).selected = false;
      }

      for (var selectedIndex = 0; selectedIndex < layers.length; selectedIndex += 1) {
        layers[selectedIndex].selected = true;
      }
    } catch (error) {
      void error;
    }
  }

  function explodeShapeLayer(
    composition,
    layer,
    paths,
    combineIntoOneLayer,
    removeSourceLayer
  ) {
    if (!paths || paths.length === 0) {
      return resultError("nothingToExtract");
    }

    var created = [];

    if (combineIntoOneLayer) {
      var combinedName = paths.length === 1
        ? getNameForPath(layer, paths[0])
        : layer.name + " Extracted Shapes";
      created.push(duplicateLayerWithPaths(layer, paths, combinedName));
    } else {
      for (var index = 0; index < paths.length; index += 1) {
        created.push(
          duplicateLayerWithPaths(
            layer,
            [paths[index]],
            getNameForPath(layer, paths[index])
          )
        );
      }
    }

    if (created.length === 0) {
      return resultError("operationFailed");
    }

    if (removeSourceLayer) {
      layer.remove();
    } else {
      var root = getShapeRoot(layer);
      removePaths(root, paths);

      if (root && root.numProperties === 0) {
        layer.remove();
      }
    }

    selectOnlyLayers(composition, created);
    return resultSuccess(created.length);
  }

  function executeCreateShapesCommand(layer) {
    var names = layer instanceof TextLayer
      ? ["Create Shapes from Text", "Создать фигуры из текста"]
      : ["Create Shapes from Vector Layer", "Создать фигуры из векторного слоя"];

    for (var index = 0; index < names.length; index += 1) {
      try {
        var commandId = app.findMenuCommandId(names[index]);

        if (commandId) {
          app.executeCommand(commandId);
          return true;
        }
      } catch (error) {
        void error;
      }
    }

    return false;
  }

  function convertLayerToShape(composition, layer) {
    try {
      var existingLayers = [];

      for (var index = 1; index <= composition.numLayers; index += 1) {
        var existingLayer = composition.layer(index);
        existingLayers.push(existingLayer);
        existingLayer.selected = false;
      }

      layer.selected = true;

      if (!executeCreateShapesCommand(layer)) {
        return null;
      }

      var selectedLayers = composition.selectedLayers || [];

      for (var selectedIndex = 0; selectedIndex < selectedLayers.length; selectedIndex += 1) {
        if (selectedLayers[selectedIndex] !== layer && getShapeRoot(selectedLayers[selectedIndex])) {
          return selectedLayers[selectedIndex];
        }
      }

      for (var candidateIndex = 1; candidateIndex <= composition.numLayers; candidateIndex += 1) {
        var candidate = composition.layer(candidateIndex);
        var existed = false;

        for (var existingIndex = 0; existingIndex < existingLayers.length; existingIndex += 1) {
          if (candidate === existingLayers[existingIndex]) {
            existed = true;
            break;
          }
        }

        if (!existed && getShapeRoot(candidate)) {
          return candidate;
        }
      }
    } catch (error) {
      void error;
    }

    return null;
  }

  function explodeExtractShapes(altKey) {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    var layers = composition.selectedLayers || [];

    if (layers.length === 0) {
      return resultError("noSelection");
    }

    var sourceLayer = layers[0];
    var result = resultError("operationFailed");
    app.beginUndoGroup("Explode / Extract Shapes");

    try {
      var sourceRoot = getShapeRoot(sourceLayer);

      if (sourceRoot) {
        var selectedPaths = getSelectedShapePaths(composition, sourceLayer);
        var paths = selectedPaths.length > 0
          ? selectedPaths
          : getTopLevelShapePaths(sourceLayer);
        result = explodeShapeLayer(
          composition,
          sourceLayer,
          paths,
          altKey && selectedPaths.length > 0,
          selectedPaths.length === 0
        );
      } else if (altKey) {
        var converted = convertLayerToShape(composition, sourceLayer);

        if (!converted) {
          result = resultError("unsupportedLayer");
        } else {
          result = explodeShapeLayer(
            composition,
            converted,
            getTopLevelShapePaths(converted),
            false,
            true
          );

          if (result.ok) {
            try {
              sourceLayer.remove();
            } catch (error) {
              void error;
            }
          }
        }
      } else {
        result = resultError("unsupportedLayer");
      }
    } catch (error) {
      result = resultError("operationFailed", describeError(error));
    } finally {
      app.endUndoGroup();
    }

    return result;
  }

  function layerPointInTarget(sourceLayer, targetLayer, point) {
    try {
      if (sourceLayer.sourcePointToComp && targetLayer.compPointToSource) {
        var compositionPoint = sourceLayer.sourcePointToComp([
          point[0] || 0,
          point[1] || 0
        ]);
        return targetLayer.compPointToSource(compositionPoint);
      }
    } catch (error) {
      void error;
    }

    return null;
  }

  function getLayerOpacity(layer) {
    try {
      var transform = layer.property("ADBE Transform Group");
      return transform.property("ADBE Opacity").value;
    } catch (error) {
      return 100;
    }
  }

  function getExistingChild(group, sourceChild) {
    if (!group || !sourceChild) {
      return null;
    }

    try {
      var byMatchName = group.property(sourceChild.matchName);

      if (byMatchName) {
        return byMatchName;
      }
    } catch (error) {
      void error;
    }

    try {
      var byName = group.property(sourceChild.name);

      if (byName) {
        return byName;
      }
    } catch (error) {
      void error;
    }

    try {
      return group.property(sourceChild.propertyIndex);
    } catch (error) {
      return null;
    }
  }

  function copyPropertyValue(source, target) {
    if (!source || !target) {
      return;
    }

    try {
      if (source.numKeys > 0 && target.setValueAtTime) {
        while (target.numKeys > 0) {
          target.removeKey(target.numKeys);
        }

        for (var index = 1; index <= source.numKeys; index += 1) {
          var time = source.keyTime(index);
          target.setValueAtTime(time, source.keyValue(index));
          var keyIndex = target.nearestKeyIndex(time);

          try {
            target.setInterpolationTypeAtKey(
              keyIndex,
              source.keyInInterpolationType(index),
              source.keyOutInterpolationType(index)
            );
          } catch (error) {
            void error;
          }

          try {
            target.setTemporalEaseAtKey(
              keyIndex,
              source.keyInTemporalEase(index),
              source.keyOutTemporalEase(index)
            );
          } catch (error) {
            void error;
          }

          try {
            if (source.isSpatial) {
              target.setSpatialTangentsAtKey(
                keyIndex,
                source.keyInSpatialTangent(index),
                source.keyOutSpatialTangent(index)
              );
              target.setSpatialContinuousAtKey(
                keyIndex,
                source.keySpatialContinuous(index)
              );
              target.setSpatialAutoBezierAtKey(
                keyIndex,
                source.keySpatialAutoBezier(index)
              );
            }
          } catch (error) {
            void error;
          }
        }
      } else if (target.setValue) {
        target.setValue(source.value);
      }
    } catch (error) {
      void error;
    }

    try {
      if (source.canSetExpression && target.canSetExpression) {
        target.expression = source.expression;
        target.expressionEnabled = source.expressionEnabled;
      }
    } catch (error) {
      void error;
    }
  }

  function copyPropertyChildren(source, target) {
    copyPropertyValue(source, target);

    if (!source || !target || !source.numProperties) {
      return;
    }

    for (var index = 1; index <= source.numProperties; index += 1) {
      var sourceChild = source.property(index);

      if (!sourceChild) {
        continue;
      }

      var targetChild = getExistingChild(target, sourceChild);

      if (!targetChild && target.addProperty) {
        try {
          targetChild = target.addProperty(sourceChild.matchName);
        } catch (error) {
          targetChild = null;
        }
      }

      if (targetChild) {
        try {
          targetChild.name = sourceChild.name;
        } catch (error) {
          void error;
        }

        copyPropertyChildren(sourceChild, targetChild);
      }
    }
  }

  function clearContentGroup(contents) {
    if (!contents) {
      return;
    }

    for (var index = contents.numProperties; index >= 1; index -= 1) {
      removeProperty(contents.property(index));
    }
  }

  function copyShapeItemToContents(sourceItem, targetContents) {
    if (!sourceItem || !targetContents || !targetContents.addProperty) {
      return null;
    }

    var copied = null;

    try {
      copied = targetContents.addProperty(sourceItem.matchName);
    } catch (error) {
      return null;
    }

    if (!copied) {
      return null;
    }

    try {
      copied.name = sourceItem.name;
    } catch (error) {
      void error;
    }

    try {
      copied.enabled = sourceItem.enabled;
    } catch (error) {
      void error;
    }

    if (sourceItem.matchName === "ADBE Vector Group") {
      var sourceContents = sourceItem.property(SHAPE_CONTENTS);
      var copiedContents = copied.property(SHAPE_CONTENTS);

      if (sourceContents && copiedContents) {
        clearContentGroup(copiedContents);

        for (var index = 1; index <= sourceContents.numProperties; index += 1) {
          copyShapeItemToContents(sourceContents.property(index), copiedContents);
        }
      }

      copyPropertyChildren(
        sourceItem.property(VECTOR_TRANSFORM),
        copied.property(VECTOR_TRANSFORM)
      );
    } else {
      copyPropertyChildren(sourceItem, copied);
    }

    return copied;
  }

  function copyShapeRootItemsManually(sourceLayer, targetContents) {
    var root = getShapeRoot(sourceLayer);

    if (!root || !targetContents) {
      return 0;
    }

    var copied = 0;

    for (var index = 1; index <= root.numProperties; index += 1) {
      if (copyShapeItemToContents(root.property(index), targetContents)) {
        copied += 1;
      }
    }

    return copied;
  }

  function getVectorValue(transform, matchName, fallback) {
    try {
      var property = transform.property(matchName);
      return property ? property.value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function applyVectorBasisToGroup(group, origin, xVector, yVector, opacity) {
    var transform = group.property(VECTOR_TRANSFORM);

    if (!transform) {
      return false;
    }

    var scaleX = Math.sqrt(
      xVector[0] * xVector[0] + xVector[1] * xVector[1]
    );
    var scaleY = Math.sqrt(
      yVector[0] * yVector[0] + yVector[1] * yVector[1]
    );
    var determinant = xVector[0] * yVector[1] - xVector[1] * yVector[0];
    var rotation = Math.atan2(xVector[1], xVector[0]) * 180 / Math.PI;

    if (determinant < 0) {
      scaleY = -scaleY;
    }

    try {
      transform.property("ADBE Vector Anchor").setValue([0, 0]);
      transform.property("ADBE Vector Position").setValue(origin);
      transform.property("ADBE Vector Scale").setValue([scaleX, scaleY]);
      transform.property("ADBE Vector Rotation").setValue(rotation);
    } catch (error) {
      return false;
    }

    try {
      if (typeof opacity === "number") {
        transform.property("ADBE Vector Opacity").setValue(opacity);
      }
    } catch (error) {
      void error;
    }

    return true;
  }

  function applyLayerTransformToVectorGroup(sourceLayer, targetLayer, group) {
    var origin = layerPointInTarget(sourceLayer, targetLayer, [0, 0]);
    var xAxis = layerPointInTarget(sourceLayer, targetLayer, [100, 0]);
    var yAxis = layerPointInTarget(sourceLayer, targetLayer, [0, 100]);

    if (!origin || !xAxis || !yAxis) {
      return false;
    }

    return applyVectorBasisToGroup(
      group,
      [origin[0], origin[1]],
      [xAxis[0] - origin[0], xAxis[1] - origin[1]],
      [yAxis[0] - origin[0], yAxis[1] - origin[1]],
      getLayerOpacity(sourceLayer)
    );
  }

  function getLayerToTargetBasis(sourceLayer, targetLayer) {
    var origin = layerPointInTarget(sourceLayer, targetLayer, [0, 0]);
    var xAxis = layerPointInTarget(sourceLayer, targetLayer, [100, 0]);
    var yAxis = layerPointInTarget(sourceLayer, targetLayer, [0, 100]);

    if (!origin || !xAxis || !yAxis) {
      return null;
    }

    return {
      origin: [origin[0], origin[1]],
      xVector: [
        (xAxis[0] - origin[0]) / 100,
        (xAxis[1] - origin[1]) / 100
      ],
      yVector: [
        (yAxis[0] - origin[0]) / 100,
        (yAxis[1] - origin[1]) / 100
      ]
    };
  }

  function getVectorTransformBasis(group) {
    var transform = group ? group.property(VECTOR_TRANSFORM) : null;

    if (!transform) {
      return {
        origin: [0, 0],
        xVector: [1, 0],
        yVector: [0, 1]
      };
    }

    var anchor = getVectorValue(transform, "ADBE Vector Anchor", [0, 0]);
    var position = getVectorValue(transform, "ADBE Vector Position", [0, 0]);
    var scale = getVectorValue(transform, "ADBE Vector Scale", [100, 100]);
    var rotation = getVectorValue(transform, "ADBE Vector Rotation", 0);
    var radians = rotation * Math.PI / 180;
    var cosine = Math.cos(radians);
    var sine = Math.sin(radians);
    var scaleX = (scale[0] || 100) / 100;
    var scaleY = (scale[1] || 100) / 100;
    var xVector = [cosine * scaleX, sine * scaleX];
    var yVector = [-sine * scaleY, cosine * scaleY];

    return {
      origin: [
        (position[0] || 0) -
          xVector[0] * (anchor[0] || 0) -
          yVector[0] * (anchor[1] || 0),
        (position[1] || 0) -
          xVector[1] * (anchor[0] || 0) -
          yVector[1] * (anchor[1] || 0)
      ],
      xVector: xVector,
      yVector: yVector
    };
  }

  function combineVectorBases(parent, child) {
    return {
      origin: [
        parent.origin[0] +
          parent.xVector[0] * child.origin[0] +
          parent.yVector[0] * child.origin[1],
        parent.origin[1] +
          parent.xVector[1] * child.origin[0] +
          parent.yVector[1] * child.origin[1]
      ],
      xVector: [
        parent.xVector[0] * child.xVector[0] +
          parent.yVector[0] * child.xVector[1],
        parent.xVector[1] * child.xVector[0] +
          parent.yVector[1] * child.xVector[1]
      ],
      yVector: [
        parent.xVector[0] * child.yVector[0] +
          parent.yVector[0] * child.yVector[1],
        parent.xVector[1] * child.yVector[0] +
          parent.yVector[1] * child.yVector[1]
      ]
    };
  }

  function makeUniqueShapeName(contents, baseName) {
    var originalName = baseName || "Shape";
    var name = originalName;
    var suffix = 2;
    var exists = true;

    while (exists) {
      exists = false;

      for (var index = 1; index <= contents.numProperties; index += 1) {
        if (contents.property(index).name === name) {
          exists = true;
          name = originalName + " " + suffix;
          suffix += 1;
          break;
        }
      }
    }

    return name;
  }

  function executeMenuCommand(names, fallbackId) {
    for (var index = 0; index < names.length; index += 1) {
      try {
        var commandId = app.findMenuCommandId(names[index]);

        if (commandId) {
          app.executeCommand(commandId);
          return true;
        }
      } catch (error) {
        void error;
      }
    }

    try {
      app.executeCommand(fallbackId);
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearCompSelection(composition) {
    try {
      var selectedProperties = composition.selectedProperties || [];

      for (var index = selectedProperties.length - 1; index >= 0; index -= 1) {
        selectedProperties[index].selected = false;
      }
    } catch (error) {
      void error;
    }

    try {
      for (var layerIndex = 1; layerIndex <= composition.numLayers; layerIndex += 1) {
        composition.layer(layerIndex).selected = false;
      }
    } catch (error) {
      void error;
    }
  }

  function selectRootShapeItems(layer) {
    var root = getShapeRoot(layer);

    if (!root) {
      return 0;
    }

    var selected = 0;

    for (var index = 1; index <= root.numProperties; index += 1) {
      try {
        root.property(index).selected = true;
        selected += 1;
      } catch (error) {
        void error;
      }
    }

    return selected;
  }

  function copyShapeRootItems(composition, layer) {
    clearCompSelection(composition);

    try {
      layer.selected = true;
    } catch (error) {
      return false;
    }

    if (selectRootShapeItems(layer) === 0) {
      return false;
    }

    return executeMenuCommand(["Copy", "Копировать"], 19);
  }

  function pasteIntoShapeContents(
    composition,
    targetLayer,
    targetRoot,
    wrapper,
    wrapperContents
  ) {
    var rootBefore = targetRoot ? targetRoot.numProperties : 0;

    for (var attempt = 0; attempt < 2; attempt += 1) {
      var wrapperBefore = wrapperContents ? wrapperContents.numProperties : 0;
      clearCompSelection(composition);

      try {
        targetLayer.selected = true;
      } catch (error) {
        return { ok: false };
      }

      try {
        if (attempt === 0 && wrapperContents) {
          wrapperContents.selected = true;
        } else {
          wrapper.selected = true;
        }
      } catch (error) {
        continue;
      }

      if (!executeMenuCommand(["Paste", "Вставить"], 20)) {
        continue;
      }

      try {
        if (
          wrapperContents &&
          wrapperContents.numProperties > wrapperBefore
        ) {
          return {
            ok: true,
            location: "wrapper",
            firstIndex: wrapperBefore + 1,
            lastIndex: wrapperContents.numProperties
          };
        }

        if (targetRoot && targetRoot.numProperties > rootBefore) {
          return {
            ok: true,
            location: "root",
            firstIndex: rootBefore + 1,
            lastIndex: targetRoot.numProperties
          };
        }
      } catch (error) {
        return { ok: false };
      }
    }

    return { ok: false };
  }

  function applyLayerBasisToRootGroups(
    sourceLayer,
    targetLayer,
    targetRoot,
    firstIndex,
    lastIndex
  ) {
    var layerBasis = getLayerToTargetBasis(sourceLayer, targetLayer);

    if (!layerBasis) {
      return false;
    }

    for (var index = firstIndex; index <= lastIndex; index += 1) {
      var group = targetRoot.property(index);

      if (!group || group.matchName !== "ADBE Vector Group") {
        continue;
      }

      var combined = combineVectorBases(
        layerBasis,
        getVectorTransformBasis(group)
      );

      if (!applyVectorBasisToGroup(
        group,
        combined.origin,
        [combined.xVector[0] * 100, combined.xVector[1] * 100],
        [combined.yVector[0] * 100, combined.yVector[1] * 100],
        getLayerOpacity(sourceLayer)
      )) {
        return false;
      }
    }

    return true;
  }

  function appendSourceToMergedLayer(composition, source, targetLayer) {
    if (!source.paths || source.paths.length === 0) {
      return 0;
    }

    var temporaryLayer = duplicateLayerWithPaths(
      source.layer,
      source.paths,
      "__Sequoia Merge Temp"
    );

    if (!temporaryLayer) {
      return 0;
    }

    var targetRoot = getShapeRoot(targetLayer);
    var wrapper = targetRoot
      ? targetRoot.addProperty("ADBE Vector Group")
      : null;
    var wrapperContents = wrapper
      ? wrapper.property(SHAPE_CONTENTS)
      : null;

    if (!wrapper || !wrapperContents) {
      try {
        temporaryLayer.remove();
      } catch (error) {
        void error;
      }

      return 0;
    }

    wrapper.name = makeUniqueShapeName(targetRoot, source.layer.name);
    clearContentGroup(wrapperContents);
    var transformApplied = applyLayerTransformToVectorGroup(
      temporaryLayer,
      targetLayer,
      wrapper
    );
    var copied = copyShapeRootItems(composition, temporaryLayer);
    var pasted = copied
      ? pasteIntoShapeContents(
          composition,
          targetLayer,
          targetRoot,
          wrapper,
          wrapperContents
        )
      : { ok: false };

    if (pasted.ok && pasted.location === "root") {
      copied = applyLayerBasisToRootGroups(
        temporaryLayer,
        targetLayer,
        targetRoot,
        pasted.firstIndex,
        pasted.lastIndex
      );

      if (copied) {
        removeProperty(wrapper);
      }
    } else {
      copied = pasted.ok === true;
    }

    if (!copied) {
      if (pasted.ok && pasted.location === "root") {
        for (
          var rootIndex = pasted.lastIndex;
          rootIndex >= pasted.firstIndex;
          rootIndex -= 1
        ) {
          removeProperty(targetRoot.property(rootIndex));
        }
      }

      clearContentGroup(wrapperContents);

      if (!transformApplied) {
        transformApplied = applyLayerTransformToVectorGroup(
          temporaryLayer,
          targetLayer,
          wrapper
        );
      }

      copied = transformApplied &&
        copyShapeRootItemsManually(temporaryLayer, wrapperContents) > 0;
    }

    try {
      temporaryLayer.remove();
    } catch (error) {
      void error;
    }

    if (!copied) {
      removeProperty(wrapper);
      return 0;
    }

    return source.paths.length;
  }

  function firstMergeSourceWithPaths(sources) {
    for (var index = 0; index < sources.length; index += 1) {
      if (sources[index].paths && sources[index].paths.length > 0) {
        return index;
      }
    }

    return -1;
  }

  function createMergedShapeLayerFromSources(composition, sources) {
    var baseIndex = firstMergeSourceWithPaths(sources);

    if (baseIndex < 0) {
      return null;
    }

    var baseSource = sources[baseIndex];
    var target = duplicateLayerWithPaths(
      baseSource.layer,
      baseSource.paths,
      "Merged Shapes"
    );

    if (!target) {
      return null;
    }

    var copiedCount = baseSource.paths.length;
    var mergedSourceIndexes = [baseIndex];

    for (var index = 0; index < sources.length; index += 1) {
      if (index === baseIndex) {
        continue;
      }

      var appended = appendSourceToMergedLayer(
        composition,
        sources[index],
        target
      );

      if (sources[index].paths.length > 0 && appended === 0) {
        try {
          target.remove();
        } catch (error) {
          void error;
        }

        return null;
      }

      if (appended > 0 || sources[index].removeLayer) {
        mergedSourceIndexes.push(index);
      }

      copiedCount += appended;
    }

    return {
      layer: target,
      copiedCount: copiedCount,
      mergedSourceIndexes: mergedSourceIndexes
    };
  }

  function collectSelectedShapePropertySources(composition, layers) {
    var sources = [];

    for (var index = 0; index < layers.length; index += 1) {
      if (!getShapeRoot(layers[index])) {
        continue;
      }

      var paths = getSelectedShapePaths(composition, layers[index]);

      if (paths.length > 0) {
        sources.push({
          layer: layers[index],
          paths: paths,
          removeLayer: false,
          removePaths: true
        });
      }
    }

    return sources;
  }

  function collectLayerMergeSources(composition, layers, shapeLayersOnly) {
    var sources = [];

    for (var index = 0; index < layers.length; index += 1) {
      var layer = layers[index];

      if (getShapeRoot(layer)) {
        var paths = getTopLevelShapePaths(layer);

        if (paths.length > 0) {
          sources.push({
            layer: layer,
            paths: paths,
            removeLayer: true,
            removePaths: false
          });
        }

        continue;
      }

      if (shapeLayersOnly) {
        continue;
      }

      var converted = convertLayerToShape(composition, layer);

      if (converted && getShapeRoot(converted)) {
        var convertedPaths = getTopLevelShapePaths(converted);

        if (convertedPaths.length > 0) {
          sources.push({
            layer: converted,
            paths: convertedPaths,
            removeLayer: true,
            removePaths: false
          });
          sources.push({
            layer: layer,
            paths: [],
            removeLayer: true,
            removePaths: false
          });
        }
      }
    }

    return sources;
  }

  function containsIndex(indexes, index) {
    for (var itemIndex = 0; itemIndex < indexes.length; itemIndex += 1) {
      if (indexes[itemIndex] === index) {
        return true;
      }
    }

    return false;
  }

  function removeMergeSources(sources, indexes) {
    for (var index = 0; index < sources.length; index += 1) {
      if (!containsIndex(indexes, index)) {
        continue;
      }

      var source = sources[index];

      if (source.removePaths && source.paths.length > 0) {
        var root = getShapeRoot(source.layer);
        removePaths(root, source.paths);

        if (root && root.numProperties === 0) {
          try {
            source.layer.remove();
          } catch (error) {
            void error;
          }
        }
      } else if (source.removeLayer) {
        try {
          source.layer.remove();
        } catch (error) {
          void error;
        }
      }
    }
  }

  function mergeShapes(altKey) {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    var selectedLayers = composition.selectedLayers || [];

    if (selectedLayers.length === 0) {
      return resultError("noSelection");
    }

    var layers = [];

    for (var index = 0; index < selectedLayers.length; index += 1) {
      layers.push(selectedLayers[index]);
    }

    var result = resultError("operationFailed");
    app.beginUndoGroup("Merge Shapes");

    try {
      var sources = altKey
        ? collectLayerMergeSources(composition, layers, true)
        : collectSelectedShapePropertySources(composition, layers);

      if (!altKey && sources.length === 0) {
        sources = collectLayerMergeSources(composition, layers, false);
      }

      if (altKey && sources.length < 2) {
        result = resultError("unsupportedLayer");
      } else if (sources.length === 0) {
        result = resultError("nothingToExtract");
      } else {
        var merged = createMergedShapeLayerFromSources(composition, sources);

        if (!merged || merged.copiedCount === 0) {
          result = resultError("operationFailed");
        } else {
          removeMergeSources(sources, merged.mergedSourceIndexes);
          selectOnlyLayers(composition, [merged.layer]);
          result = resultSuccess(merged.copiedCount);
        }
      }
    } catch (error) {
      result = resultError("operationFailed", describeError(error));
    } finally {
      app.endUndoGroup();
    }

    return result;
  }

  function makeUniqueLayerName(composition, baseName) {
    var originalName = baseName || "Controller";
    var name = originalName;
    var suffix = 2;
    var exists = true;

    while (exists) {
      exists = false;

      for (var index = 1; index <= composition.numLayers; index += 1) {
        if (composition.layer(index).name === name) {
          exists = true;
          name = originalName + " " + suffix;
          suffix += 1;
          break;
        }
      }
    }

    return name;
  }

  function getLayerCenterInComp(layer, composition) {
    try {
      if (layer.sourceRectAtTime && layer.sourcePointToComp) {
        var bounds = layer.sourceRectAtTime(composition.time, false);
        return layer.sourcePointToComp([
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2
        ]);
      }
    } catch (error) {
      void error;
    }

    try {
      var transform = layer.property("ADBE Transform Group");
      var anchor = transform.property("ADBE Anchor Point").value;

      if (layer.sourcePointToComp) {
        return layer.sourcePointToComp([anchor[0], anchor[1]]);
      }

      var position = transform.property("ADBE Position").value;
      return [position[0], position[1]];
    } catch (error) {
      return [composition.width / 2, composition.height / 2];
    }
  }

  function getSelectionCenterInComp(layers, composition) {
    var minimumX = Number.POSITIVE_INFINITY;
    var minimumY = Number.POSITIVE_INFINITY;
    var maximumX = Number.NEGATIVE_INFINITY;
    var maximumY = Number.NEGATIVE_INFINITY;
    var foundBounds = false;

    for (var index = 0; index < layers.length; index += 1) {
      try {
        if (layers[index].sourceRectAtTime && layers[index].sourcePointToComp) {
          var bounds = layers[index].sourceRectAtTime(composition.time, false);
          var points = [
            [bounds.left, bounds.top],
            [bounds.left + bounds.width, bounds.top],
            [bounds.left + bounds.width, bounds.top + bounds.height],
            [bounds.left, bounds.top + bounds.height]
          ];

          for (var pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
            var point = layers[index].sourcePointToComp(points[pointIndex]);
            minimumX = Math.min(minimumX, point[0]);
            minimumY = Math.min(minimumY, point[1]);
            maximumX = Math.max(maximumX, point[0]);
            maximumY = Math.max(maximumY, point[1]);
            foundBounds = true;
          }
        }
      } catch (error) {
        void error;
      }
    }

    if (foundBounds) {
      return [
        (minimumX + maximumX) / 2,
        (minimumY + maximumY) / 2
      ];
    }

    var sum = [0, 0];

    for (var centerIndex = 0; centerIndex < layers.length; centerIndex += 1) {
      var center = getLayerCenterInComp(layers[centerIndex], composition);
      sum[0] += center[0] || 0;
      sum[1] += center[1] || 0;
    }

    return [sum[0] / layers.length, sum[1] / layers.length];
  }

  function setNullPosition(nullLayer, point) {
    if (!point) {
      return true;
    }

    try {
      var transform = nullLayer.property("ADBE Transform Group");
      var position = transform ? transform.property("ADBE Position") : null;

      if (!position) {
        return false;
      }

      position.setValue(
        nullLayer.threeDLayer
          ? [point[0], point[1], point.length > 2 ? point[2] : 0]
          : [point[0], point[1]]
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function createNullLayer(composition, baseName, point, threeD) {
    var nullLayer = composition.layers.addNull();
    nullLayer.name = makeUniqueLayerName(composition, baseName);

    if (threeD) {
      try {
        nullLayer.threeDLayer = true;
      } catch (error) {
        void error;
      }
    }

    if (!setNullPosition(nullLayer, point)) {
      nullLayer.remove();
      return null;
    }

    return nullLayer;
  }

  function has3DLayer(layers) {
    for (var index = 0; index < layers.length; index += 1) {
      try {
        if (layers[index].threeDLayer) {
          return true;
        }
      } catch (error) {
        void error;
      }
    }

    return false;
  }

  function createNullControllers(altKey, shiftKey) {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    var selectedLayers = composition.selectedLayers || [];

    if (selectedLayers.length === 0) {
      return resultError("noSelection");
    }

    var layers = [];

    for (var index = 0; index < selectedLayers.length; index += 1) {
      layers.push(selectedLayers[index]);
    }

    var created = [];
    var errors = [];
    app.beginUndoGroup("Create Null Controller");

    try {
      if (shiftKey) {
        for (var layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
          var layer = layers[layerIndex];
          var layerNull = createNullLayer(
            composition,
            layer.name + " Null",
            getLayerCenterInComp(layer, composition),
            !!layer.threeDLayer
          );

          if (!layerNull) {
            errors.push(layer.name + ": Null could not be created.");
            continue;
          }

          try {
            layer.parent = layerNull;
            created.push(layerNull);
          } catch (error) {
            errors.push(layer.name + ": " + describeError(error));
            layerNull.remove();
          }
        }
      } else {
        var point = altKey
          ? null
          : getSelectionCenterInComp(layers, composition);
        var groupNull = createNullLayer(
          composition,
          layers.length === 1 ? layers[0].name + " Null" : "Selection Null",
          point,
          has3DLayer(layers)
        );

        if (!groupNull) {
          return resultError("operationFailed");
        }

        var parented = 0;

        for (var parentIndex = 0; parentIndex < layers.length; parentIndex += 1) {
          try {
            layers[parentIndex].parent = groupNull;
            parented += 1;
          } catch (error) {
            errors.push(
              layers[parentIndex].name + ": " + describeError(error)
            );
          }
        }

        if (parented > 0) {
          created.push(groupNull);
        } else {
          groupNull.remove();
        }
      }

      if (created.length === 0) {
        return resultError("operationFailed", errors.join("\n"));
      }

      selectOnlyLayers(composition, created);

      if (errors.length > 0) {
        return resultPartial(created.length, errors.join("\n"));
      }

      return resultSuccess(created.length);
    } catch (error) {
      return resultError("operationFailed", describeError(error));
    } finally {
      app.endUndoGroup();
    }
  }

  function isPathProperty(property) {
    return property && (
      property.matchName === "ADBE Vector Shape" ||
      property.matchName === "ADBE Mask Shape"
    );
  }

  function matrixIdentity() {
    return [1, 0, 0, 1, 0, 0];
  }

  function matrixMultiply(first, second) {
    return [
      first[0] * second[0] + first[2] * second[1],
      first[1] * second[0] + first[3] * second[1],
      first[0] * second[2] + first[2] * second[3],
      first[1] * second[2] + first[3] * second[3],
      first[0] * second[4] + first[2] * second[5] + first[4],
      first[1] * second[4] + first[3] * second[5] + first[5]
    ];
  }

  function matrixTranslate(x, y) {
    return [1, 0, 0, 1, x, y];
  }

  function matrixScale(x, y) {
    return [x, 0, 0, y, 0, 0];
  }

  function matrixRotate(degrees) {
    var radians = degrees * Math.PI / 180;
    var cosine = Math.cos(radians);
    var sine = Math.sin(radians);
    return [cosine, sine, -sine, cosine, 0, 0];
  }

  function matrixApply(matrix, point) {
    return [
      matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
      matrix[1] * point[0] + matrix[3] * point[1] + matrix[5]
    ];
  }

  function getVectorTransformMatrix(group) {
    var transform = group ? group.property(VECTOR_TRANSFORM) : null;

    if (!transform) {
      return matrixIdentity();
    }

    var anchor = getVectorValue(transform, "ADBE Vector Anchor", [0, 0]);
    var position = getVectorValue(transform, "ADBE Vector Position", [0, 0]);
    var scale = getVectorValue(transform, "ADBE Vector Scale", [100, 100]);
    var rotation = getVectorValue(transform, "ADBE Vector Rotation", 0);
    var matrix = matrixIdentity();
    matrix = matrixMultiply(
      matrix,
      matrixTranslate(position[0] || 0, position[1] || 0)
    );
    matrix = matrixMultiply(matrix, matrixRotate(rotation || 0));
    matrix = matrixMultiply(
      matrix,
      matrixScale((scale[0] || 100) / 100, (scale[1] || 100) / 100)
    );
    matrix = matrixMultiply(
      matrix,
      matrixTranslate(-(anchor[0] || 0), -(anchor[1] || 0))
    );
    return matrix;
  }

  function getShapePathGroups(pathProperty) {
    var groups = [];

    if (!pathProperty || pathProperty.matchName !== "ADBE Vector Shape") {
      return groups;
    }

    var current = pathProperty;

    while (current) {
      var parent = null;

      try {
        parent = current.propertyGroup(1);
      } catch (error) {
        break;
      }

      if (!parent) {
        break;
      }

      if (parent.matchName === "ADBE Vector Group") {
        groups.unshift(parent);
      }

      if (parent.matchName === SHAPE_ROOT) {
        break;
      }

      current = parent;
    }

    return groups;
  }

  function getPathLocalToLayerMatrix(pathProperty) {
    var groups = getShapePathGroups(pathProperty);
    var matrix = matrixIdentity();

    for (var index = 0; index < groups.length; index += 1) {
      matrix = matrixMultiply(matrix, getVectorTransformMatrix(groups[index]));
    }

    return matrix;
  }

  function propertyBelongsToGroup(group, target) {
    if (!group || !target) {
      return false;
    }

    if (sameProperty(group, target)) {
      return true;
    }

    if (!group.numProperties) {
      return false;
    }

    for (var index = 1; index <= group.numProperties; index += 1) {
      var child = null;

      try {
        child = group.property(index);
      } catch (error) {
        child = null;
      }

      if (child && propertyBelongsToGroup(child, target)) {
        return true;
      }
    }

    return false;
  }

  function findSelectedPathInfo(composition) {
    var selectedProperties = composition.selectedProperties || [];
    var selectedLayers = composition.selectedLayers || [];

    for (var index = 0; index < selectedProperties.length; index += 1) {
      var property = selectedProperties[index];

      if (!isPathProperty(property)) {
        continue;
      }

      for (var layerIndex = 0; layerIndex < selectedLayers.length; layerIndex += 1) {
        if (propertyBelongsToGroup(selectedLayers[layerIndex], property)) {
          return { layer: selectedLayers[layerIndex], property: property };
        }
      }

      for (var allLayerIndex = 1; allLayerIndex <= composition.numLayers; allLayerIndex += 1) {
        if (propertyBelongsToGroup(composition.layer(allLayerIndex), property)) {
          return { layer: composition.layer(allLayerIndex), property: property };
        }
      }
    }

    return null;
  }

  function expressionQuote(value) {
    return "\"" + String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, "\\\"")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n") + "\"";
  }

  function buildShapePathExpressionReference(layerName, pathProperty) {
    var pathGroup = null;

    try {
      pathGroup = pathProperty.propertyGroup(1);
    } catch (error) {
      return "";
    }

    if (!pathGroup) {
      return "";
    }

    var names = [pathGroup.name];
    var current = pathGroup;

    while (current) {
      var parent = null;

      try {
        parent = current.propertyGroup(1);
      } catch (error) {
        break;
      }

      if (!parent || parent.matchName === SHAPE_ROOT) {
        break;
      }

      if (parent.matchName === "ADBE Vector Group") {
        names.push(parent.name);
        current = parent;
      } else {
        current = parent;
      }
    }

    names.reverse();
    var reference = "thisComp.layer(" + expressionQuote(layerName) + ")";

    for (var index = 0; index < names.length; index += 1) {
      reference += ".content(" + expressionQuote(names[index]) + ")";
    }

    return reference + ".path";
  }

  function buildPathExpressionReference(layer, pathProperty) {
    if (pathProperty.matchName === "ADBE Mask Shape") {
      var mask = pathProperty.propertyGroup(1);
      return "thisComp.layer(" + expressionQuote(layer.name) + ")" +
        ".mask(" + expressionQuote(mask.name) + ").maskPath";
    }

    return buildShapePathExpressionReference(layer.name, pathProperty);
  }

  function matrixToExpression(matrix) {
    var values = [];

    for (var index = 0; index < matrix.length; index += 1) {
      values.push(String(Math.round(matrix[index] * 1000000) / 1000000));
    }

    return "[" + values.join(",") + "]";
  }

  function buildNullFollowsPathExpression(
    layerName,
    pathReference,
    pointIndex,
    matrix
  ) {
    return [
      "var __sqPoint = " + pathReference + ".points()[" + pointIndex + "];",
      "var __sqMatrix = " + matrixToExpression(matrix) + ";",
      "var __sqLayerPoint = [",
      "  __sqMatrix[0] * __sqPoint[0] + __sqMatrix[2] * __sqPoint[1] + __sqMatrix[4],",
      "  __sqMatrix[1] * __sqPoint[0] + __sqMatrix[3] * __sqPoint[1] + __sqMatrix[5],",
      "  0",
      "];",
      "thisComp.layer(" + expressionQuote(layerName) + ").toComp(__sqLayerPoint);"
    ].join("\n");
  }

  function buildPathFollowsNullsExpression(layerName, nullNames, matrix) {
    var lines = [
      "var __sqPoints = points();",
      "var __sqInTangents = inTangents();",
      "var __sqOutTangents = outTangents();",
      "var __sqClosed = isClosed();",
      "var __sqMatrix = " + matrixToExpression(matrix) + ";",
      "var __sqDet = __sqMatrix[0] * __sqMatrix[3] - __sqMatrix[2] * __sqMatrix[1];",
      "__sqDet = Math.abs(__sqDet) < 0.000001 ? 0.000001 : __sqDet;",
      "function __sqFromComp(__sqCompPoint) {",
      "  var __sqLayerPoint = thisComp.layer(" + expressionQuote(layerName) + ").fromComp(__sqCompPoint);",
      "  var __sqX = __sqLayerPoint[0] - __sqMatrix[4];",
      "  var __sqY = __sqLayerPoint[1] - __sqMatrix[5];",
      "  return [",
      "    (__sqMatrix[3] * __sqX - __sqMatrix[2] * __sqY) / __sqDet,",
      "    (-__sqMatrix[1] * __sqX + __sqMatrix[0] * __sqY) / __sqDet",
      "  ];",
      "}"
    ];

    for (var index = 0; index < nullNames.length; index += 1) {
      lines.push(
        "__sqPoints[" + index + "] = __sqFromComp(" +
        "thisComp.layer(" + expressionQuote(nullNames[index]) + ")" +
        ".toComp(thisComp.layer(" + expressionQuote(nullNames[index]) + ")" +
        ".anchorPoint));"
      );
    }

    lines.push(
      "createPath(__sqPoints, __sqInTangents, __sqOutTangents, __sqClosed);"
    );
    return lines.join("\n");
  }

  function getPathVertices(pathProperty) {
    try {
      var shape = pathProperty.value;
      return shape.vertices || [];
    } catch (error) {
      return [];
    }
  }

  function linkPathNulls(altKey) {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    var info = findSelectedPathInfo(composition);

    if (!info) {
      return resultError("noSelection");
    }

    var layer = info.layer;
    var pathProperty = info.property;
    var vertices = getPathVertices(pathProperty);
    var previousPathExpression = "";
    var previousPathExpressionEnabled = false;

    try {
      previousPathExpression = pathProperty.expression || "";
      previousPathExpressionEnabled = pathProperty.expressionEnabled === true;
    } catch (error) {
      void error;
    }

    if (!vertices || vertices.length === 0) {
      return resultError("nothingToExtract");
    }

    var created = [];
    app.beginUndoGroup("Path Nulls");

    try {
      var matrix = getPathLocalToLayerMatrix(pathProperty);
      var pathReference = buildPathExpressionReference(layer, pathProperty);

      if (!pathReference) {
        return resultError("unsupportedLayer");
      }

      for (var index = 0; index < vertices.length; index += 1) {
        var layerPoint = matrixApply(matrix, vertices[index]);
        var compositionPoint = layer.sourcePointToComp
          ? layer.sourcePointToComp(layerPoint)
          : layerPoint;
        var nullLayer = createNullLayer(
          composition,
          layer.name + " Path " + (index + 1),
          compositionPoint,
          false
        );

        if (!nullLayer) {
          throw new Error("A Path Null could not be created.");
        }

        created.push(nullLayer);

        if (!altKey) {
          var position = nullLayer
            .property("ADBE Transform Group")
            .property("ADBE Position");
          position.expression = buildNullFollowsPathExpression(
            layer.name,
            pathReference,
            index,
            matrix
          );
          position.expressionEnabled = true;

          if (position.expressionError) {
            throw new Error(position.expressionError);
          }
        }
      }

      if (altKey) {
        var nullNames = [];

        for (var nullIndex = 0; nullIndex < created.length; nullIndex += 1) {
          nullNames.push(created[nullIndex].name);
        }

        pathProperty.expression = buildPathFollowsNullsExpression(
          layer.name,
          nullNames,
          matrix
        );
        pathProperty.expressionEnabled = true;

        if (pathProperty.expressionError) {
          throw new Error(pathProperty.expressionError);
        }
      }

      selectOnlyLayers(composition, created);
      return resultSuccess(created.length);
    } catch (error) {
      if (altKey) {
        try {
          pathProperty.expression = previousPathExpression;
          pathProperty.expressionEnabled = previousPathExpressionEnabled;
        } catch (restoreError) {
          void restoreError;
        }
      }

      for (var cleanupIndex = created.length - 1; cleanupIndex >= 0; cleanupIndex -= 1) {
        try {
          created[cleanupIndex].remove();
        } catch (cleanupError) {
          void cleanupError;
        }
      }

      return resultError("operationFailed", describeError(error));
    } finally {
      app.endUndoGroup();
    }
  }

  function padColorIndex(index) {
    return index < 10 ? "0" + index : String(index);
  }

  function getColorControlName(index) {
    return index === 1 ? "Color" : "Color " + padColorIndex(index);
  }

  function getColorControlsMatchName(count) {
    return COLOR_CONTROLS_MATCH_NAME_PREFIX + padColorIndex(count);
  }

  function isColorControlsEffect(effect) {
    try {
      return effect &&
        String(effect.matchName || "").indexOf(
          COLOR_CONTROLS_MATCH_NAME_PREFIX
        ) === 0;
    } catch (error) {
      return false;
    }
  }

  function isInsideColorControlsEffect(property) {
    try {
      for (var depth = 1; depth <= property.propertyDepth; depth += 1) {
        if (isColorControlsEffect(property.propertyGroup(depth))) {
          return true;
        }
      }
    } catch (error) {
      void error;
    }

    return false;
  }

  function isColorValue(value) {
    return value &&
      value.length &&
      (value.length === 3 || value.length === 4) &&
      typeof value[0] === "number" &&
      typeof value[1] === "number" &&
      typeof value[2] === "number" &&
      value[0] >= 0 && value[0] <= 1 &&
      value[1] >= 0 && value[1] <= 1 &&
      value[2] >= 0 && value[2] <= 1;
  }

  function getColorKey(value) {
    var alpha = value.length > 3 ? value[3] : 1;
    return [
      Math.round(value[0] * 255),
      Math.round(value[1] * 255),
      Math.round(value[2] * 255),
      Math.round(alpha * 255)
    ].join("-");
  }

  function isLikelyColorProperty(property, value) {
    if (!isColorValue(value)) {
      return false;
    }

    try {
      if (property.propertyValueType === PropertyValueType.COLOR) {
        return true;
      }
    } catch (error) {
      void error;
    }

    try {
      var matchName = String(property.matchName || "").toLowerCase();
      var name = String(property.name || "").toLowerCase();
      return matchName.indexOf("color") >= 0 ||
        name.indexOf("color") >= 0 ||
        name.indexOf("colour") >= 0 ||
        name.indexOf("цвет") >= 0;
    } catch (error) {
      return false;
    }
  }

  function isEnabledProperty(property) {
    try {
      for (var depth = 1; depth <= property.propertyDepth; depth += 1) {
        var group = property.propertyGroup(depth);

        if (group && group.enabled === false) {
          return false;
        }
      }
    } catch (error) {
      void error;
    }

    return true;
  }

  function isShapeFillOrStrokeColor(property) {
    try {
      return property.matchName === "ADBE Vector Fill Color" ||
        property.matchName === "ADBE Vector Stroke Color";
    } catch (error) {
      return false;
    }
  }

  function getShapeSiblingValue(property, matchName, fallback) {
    try {
      var group = property.propertyGroup(1);
      var sibling = group ? group.property(matchName) : null;
      var value = sibling ? sibling.value : fallback;
      return typeof value === "number" ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function isVisibleShapeColorProperty(property) {
    if (!isShapeFillOrStrokeColor(property)) {
      return true;
    }

    try {
      var group = property.propertyGroup(1);

      if (!group || group.enabled === false) {
        return false;
      }

      if (property.matchName === "ADBE Vector Fill Color") {
        return getShapeSiblingValue(
          property,
          "ADBE Vector Fill Opacity",
          100
        ) > 0;
      }

      return getShapeSiblingValue(
        property,
        "ADBE Vector Stroke Opacity",
        100
      ) > 0 && getShapeSiblingValue(
        property,
        "ADBE Vector Stroke Width",
        0
      ) > 0;
    } catch (error) {
      return false;
    }
  }

  function collectColorBindingsFromProperty(property, bindings) {
    if (!property) {
      return;
    }

    try {
      for (var index = 1; index <= property.numProperties; index += 1) {
        collectColorBindingsFromProperty(property.property(index), bindings);
      }
    } catch (error) {
      void error;
    }

    try {
      if (
        property.canSetExpression !== true ||
        isInsideColorControlsEffect(property) ||
        !isEnabledProperty(property) ||
        !isVisibleShapeColorProperty(property)
      ) {
        return;
      }

      var value = property.value;

      if (!isLikelyColorProperty(property, value)) {
        return;
      }

      bindings.push({
        property: property,
        value: copyArray(value),
        key: getColorKey(value),
        dimensions: value.length
      });
    } catch (error) {
      void error;
    }
  }

  function collectColorBindings(layers) {
    var bindings = [];

    for (var index = 0; index < layers.length; index += 1) {
      collectColorBindingsFromProperty(layers[index], bindings);
    }

    return bindings;
  }

  function getColorControlsPresetFile(count) {
    var hostScriptFile = new File($.fileName);
    var extensionFolder = hostScriptFile.parent.parent;
    var presetFile = new File(
      extensionFolder.fsName +
      "/assets/SequoiaColorControls" +
      padColorIndex(count) +
      ".ffx"
    );

    return presetFile.exists ? presetFile : null;
  }

  function isCompleteColorControlsEffect(effect, count) {
    if (!effect || effect.matchName !== getColorControlsMatchName(count)) {
      return false;
    }

    for (var index = 1; index <= count; index += 1) {
      var control = effect.property(index);

      if (!control || control.name !== getColorControlName(index)) {
        return false;
      }
    }

    return true;
  }

  function addColorControlsEffect(layer, count) {
    var effects = layer.property("ADBE Effect Parade");
    var presetFile = getColorControlsPresetFile(count);

    if (!effects || !presetFile) {
      return null;
    }

    var previousCount = effects.numProperties;
    applyPresetToOnlyLayer(layer, presetFile);
    effects = layer.property("ADBE Effect Parade");

    for (var index = effects.numProperties; index > previousCount; index -= 1) {
      var effect = effects.property(index);

      if (isCompleteColorControlsEffect(effect, count)) {
        effect.name = COLOR_CONTROLS_EFFECT_NAME;
        return effect;
      }
    }

    return null;
  }

  function getPaletteMap(effect) {
    var map = {};

    if (!effect || !isColorControlsEffect(effect)) {
      return map;
    }

    for (var index = 1; index <= effect.numProperties; index += 1) {
      try {
        var control = effect.property(index);
        var value = control.value;

        if (isColorValue(value)) {
          map[getColorKey(value)] = control.name;
        }
      } catch (error) {
        void error;
      }
    }

    return map;
  }

  function paletteContainsKeys(map, keys) {
    for (var index = 0; index < keys.length; index += 1) {
      if (!map[keys[index]]) {
        return false;
      }
    }

    return true;
  }

  function findReusablePalette(composition, keys) {
    for (var layerIndex = 1; layerIndex <= composition.numLayers; layerIndex += 1) {
      var layer = composition.layer(layerIndex);
      var effects = null;

      try {
        effects = layer.property("ADBE Effect Parade");
      } catch (error) {
        effects = null;
      }

      if (!effects) {
        continue;
      }

      for (var effectIndex = 1; effectIndex <= effects.numProperties; effectIndex += 1) {
        var effect = effects.property(effectIndex);

        if (!isColorControlsEffect(effect)) {
          continue;
        }

        var map = getPaletteMap(effect);

        if (paletteContainsKeys(map, keys)) {
          return { layer: layer, effect: effect, map: map };
        }
      }
    }

    return null;
  }

  function setColorControlValue(effect, name, value) {
    try {
      var property = effect.property(name);

      if (!property) {
        return false;
      }

      property.setValue(
        value.length > 3
          ? value
          : [value[0], value[1], value[2], 1]
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function buildColorControlExpression(
    controllerName,
    effectName,
    colorName,
    dimensions
  ) {
    var reference = "thisComp.layer(" + expressionQuote(controllerName) + ")" +
      ".effect(" + expressionQuote(effectName) + ")" +
      "(" + expressionQuote(colorName) + ")";

    if (dimensions === 3) {
      return "var __sqColor = " + reference + ";\n" +
        "[__sqColor[0], __sqColor[1], __sqColor[2]];";
    }

    return reference + ";";
  }

  function createColorControls() {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    var selectedLayers = composition.selectedLayers || [];

    if (selectedLayers.length === 0) {
      return resultError("noSelection");
    }

    var layers = [];

    for (var index = 0; index < selectedLayers.length; index += 1) {
      layers.push(selectedLayers[index]);
    }

    var paletteLayerCreated = null;
    app.beginUndoGroup("Create Color Controls");

    try {
      var bindings = collectColorBindings(layers);

      if (bindings.length === 0) {
        return resultError("nothingToExtract");
      }

      var byColor = {};
      var order = [];

      for (var bindingIndex = 0; bindingIndex < bindings.length; bindingIndex += 1) {
        var binding = bindings[bindingIndex];

        if (!byColor[binding.key]) {
          byColor[binding.key] = [];
          order.push(binding.key);
        }

        byColor[binding.key].push(binding);
      }

      if (order.length > COLOR_CONTROLS_MAX_COLORS) {
        return resultError("tooManyColors");
      }

      var palette = findReusablePalette(composition, order);
      var createdController = false;

      if (!palette) {
        var controller = createNullLayer(
          composition,
          COLOR_CONTROLS_EFFECT_NAME,
          null,
          false
        );

        if (!controller) {
          return resultError("operationFailed");
        }

        paletteLayerCreated = controller;

        var colorEffect = addColorControlsEffect(controller, order.length);

        if (!colorEffect) {
          controller.remove();
          selectOnlyLayers(composition, layers);
          return resultError("missingPseudoEffect");
        }

        var colorMap = {};

        for (var colorIndex = 0; colorIndex < order.length; colorIndex += 1) {
          var key = order[colorIndex];
          var colorName = getColorControlName(colorIndex + 1);

          if (!setColorControlValue(
            colorEffect,
            colorName,
            byColor[key][0].value
          )) {
            controller.remove();
            selectOnlyLayers(composition, layers);
            return resultError("operationFailed");
          }

          colorMap[key] = colorName;
        }

        palette = {
          layer: controller,
          effect: colorEffect,
          map: colorMap
        };
        createdController = true;
      }

      var linked = 0;
      var errors = [];

      for (var keyIndex = 0; keyIndex < order.length; keyIndex += 1) {
        var colorKey = order[keyIndex];
        var controlName = palette.map[colorKey];
        var colorBindings = byColor[colorKey];

        if (!controlName) {
          continue;
        }

        for (var propertyIndex = 0; propertyIndex < colorBindings.length; propertyIndex += 1) {
          var colorBinding = colorBindings[propertyIndex];
          var previousExpression = "";
          var previousExpressionEnabled = false;

          try {
            previousExpression = colorBinding.property.expression || "";
            previousExpressionEnabled =
              colorBinding.property.expressionEnabled === true;
            colorBinding.property.expression = buildColorControlExpression(
              palette.layer.name,
              palette.effect.name,
              controlName,
              colorBinding.dimensions
            );
            colorBinding.property.expressionEnabled = true;

            if (colorBinding.property.expressionError) {
              throw new Error(colorBinding.property.expressionError);
            }

            linked += 1;
          } catch (error) {
            try {
              colorBinding.property.expression = previousExpression;
              colorBinding.property.expressionEnabled = previousExpressionEnabled;
            } catch (restoreError) {
              void restoreError;
            }

            errors.push(describeError(error));
          }
        }
      }

      if (linked === 0) {
        if (createdController) {
          palette.layer.remove();
        }

        selectOnlyLayers(composition, layers);
        return resultError("operationFailed", errors.join("\n"));
      }

      selectOnlyLayers(composition, [palette.layer]);

      if (errors.length > 0) {
        return resultPartial(linked, errors.join("\n"));
      }

      return resultSuccess(linked);
    } catch (error) {
      if (paletteLayerCreated) {
        try {
          paletteLayerCreated.remove();
        } catch (cleanupError) {
          void cleanupError;
        }
      }

      selectOnlyLayers(composition, layers);
      return resultError("operationFailed", describeError(error));
    } finally {
      app.endUndoGroup();
    }
  }

  function hasRenderableShapeContent(property) {
    if (!property) {
      return false;
    }

    try {
      if (
        property.matchName === "ADBE Vector Shape" ||
        property.matchName === "ADBE Vector Shape - Group" ||
        property.matchName === "ADBE Vector Graphic - Fill" ||
        property.matchName === "ADBE Vector Graphic - Stroke" ||
        property.matchName === "ADBE Vector Graphic - G-Fill" ||
        property.matchName === "ADBE Vector Graphic - G-Stroke"
      ) {
        return true;
      }
    } catch (error) {
      return false;
    }

    try {
      for (var index = 1; index <= property.numProperties; index += 1) {
        if (hasRenderableShapeContent(property.property(index))) {
          return true;
        }
      }
    } catch (error) {
      void error;
    }

    return false;
  }

  function looksLikeEmptyArtboardGroup(property) {
    try {
      var name = String(property.name || "").toLowerCase();
      var hasArtboardName = name.indexOf("artboard") >= 0 ||
        name.indexOf("art board") >= 0 ||
        name.indexOf("монтажная область") >= 0;
      return hasArtboardName && !hasRenderableShapeContent(property);
    } catch (error) {
      return false;
    }
  }

  function cleanIllustratorArtboardGroups(layer) {
    var root = getShapeRoot(layer);

    if (!root) {
      return 0;
    }

    var removed = 0;

    for (var index = root.numProperties; index >= 1; index -= 1) {
      var child = root.property(index);

      if (!hasRenderableShapeContent(child) || looksLikeEmptyArtboardGroup(child)) {
        if (removeProperty(child)) {
          removed += 1;
        }
      }
    }

    return removed;
  }

  function convertVectorToShape(altKey, shiftKey) {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    var selectedLayers = composition.selectedLayers || [];

    if (selectedLayers.length === 0) {
      return resultError("noSelection");
    }

    var sources = [];

    for (var index = 0; index < selectedLayers.length; index += 1) {
      sources.push(selectedLayers[index]);
    }

    var created = [];
    var errors = [];
    app.beginUndoGroup("Vector to Shape");

    try {
      for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
        var source = sources[sourceIndex];

        if (getShapeRoot(source)) {
          errors.push(source.name + ": already a Shape Layer.");
          continue;
        }

        var converted = convertLayerToShape(composition, source);

        if (!converted || !getShapeRoot(converted)) {
          errors.push(source.name + ": unsupported vector source.");
          continue;
        }

        if (shiftKey) {
          cleanIllustratorArtboardGroups(converted);
        }

        created.push(converted);

        if (altKey) {
          try {
            source.remove();
          } catch (error) {
            errors.push(source.name + ": source could not be removed.");
          }
        }
      }

      if (created.length === 0) {
        return resultError("unsupportedLayer", errors.join("\n"));
      }

      selectOnlyLayers(composition, created);

      if (errors.length > 0) {
        return resultPartial(created.length, errors.join("\n"));
      }

      return resultSuccess(created.length);
    } catch (error) {
      return resultError("operationFailed", describeError(error));
    } finally {
      app.endUndoGroup();
    }
  }

  Sequoia.flipSelectedLayers = function (axis) {
    return formatResult(
      flipSelectedLayers(axis === "vertical" ? "vertical" : "horizontal")
    );
  };

  Sequoia.fitSelectedLayers = function (dimension) {
    return formatResult(
      fitSelectedLayers(dimension === "height" ? "height" : "width")
    );
  };

  Sequoia.explodeExtractShapes = function (altKey) {
    return formatResult(explodeExtractShapes(altKey === true));
  };

  Sequoia.mergeShapes = function (altKey) {
    return formatResult(mergeShapes(altKey === true));
  };

  Sequoia.createNullControllers = function (altKey, shiftKey) {
    return formatResult(
      createNullControllers(altKey === true, shiftKey === true)
    );
  };

  Sequoia.linkPathNulls = function (altKey) {
    return formatResult(linkPathNulls(altKey === true));
  };

  Sequoia.createColorControls = function () {
    return formatResult(createColorControls());
  };

  Sequoia.convertVectorToShape = function (altKey, shiftKey) {
    return formatResult(
      convertVectorToShape(altKey === true, shiftKey === true)
    );
  };

  global.Sequoia = Sequoia;
})($.global);
