/* oxlint-disable no-unused-vars -- ExtendScript requires a catch binding. */
(function (global) {
  var Sequoia = global.Sequoia || {};
  var TIME_EPSILON = 0.00001;

  function reasonMessage(reason) {
    if (reason === "noSelection") {
      return "Open a composition and select keyframes in the timeline.";
    }

    if (reason === "noLayerSelection") {
      return "Select the layers that should receive the keyframes.";
    }

    if (reason === "emptyClipboard") {
      return "Copy keyframes before pasting them.";
    }

    if (reason === "invalidValue") {
      return "Enter a valid non-zero value.";
    }

    if (reason === "unsupportedProperty") {
      return "The selected property cannot be retimed.";
    }

    if (reason === "singleLayerRequired") {
      return "Copy keyframes from one layer at a time.";
    }

    return "After Effects could not complete the operation.";
  }

  function resultError(reason) {
    return { ok: false, reason: reason || "operationFailed" };
  }

  function resultSuccess(count) {
    return { ok: true, count: count || 0 };
  }

  function formatResult(result) {
    if (result && result.ok) {
      return result.count > 0 ? "ok|" + result.count : "noop|0";
    }

    return "error|" + reasonMessage(result ? result.reason : "operationFailed");
  }

  function getActiveComposition() {
    var composition = app.project.activeItem;
    return composition instanceof CompItem ? composition : null;
  }

  function copyArrayValue(value) {
    if (!value || typeof value.length !== "number") {
      return value;
    }

    var result = [];

    for (var index = 0; index < value.length; index += 1) {
      result.push(value[index]);
    }

    return result;
  }

  function copyEasePoints(points) {
    var result = [];

    if (!points || typeof points.length !== "number") {
      return result;
    }

    for (var index = 0; index < points.length; index += 1) {
      result.push({
        speed: points[index].speed,
        influence: points[index].influence
      });
    }

    return result;
  }

  function toKeyframeEases(points) {
    var result = [];

    for (var index = 0; index < points.length; index += 1) {
      result.push(new KeyframeEase(points[index].speed, points[index].influence));
    }

    return result;
  }

  function reverseEasePoints(points) {
    var result = [];

    for (var index = 0; index < points.length; index += 1) {
      result.push({
        speed: -points[index].speed,
        influence: points[index].influence
      });
    }

    return result;
  }

  function isRetimableProperty(property) {
    if (!property || !property.selectedKeys || !property.numKeys) {
      return false;
    }

    return (
      property.propertyValueType !== PropertyValueType.CUSTOM_VALUE &&
      property.propertyValueType !== PropertyValueType.NO_VALUE
    );
  }

  function getLayerForProperty(property) {
    try {
      return property.propertyGroup(property.propertyDepth);
    } catch (error) {
      void error;
      return null;
    }
  }

  function getSelectedTargets(composition) {
    var targets = [];
    var properties = composition.selectedProperties || [];

    for (var index = 0; index < properties.length; index += 1) {
      var property = properties[index];

      if (!property || !property.selectedKeys || property.selectedKeys.length === 0) {
        continue;
      }

      var layer = getLayerForProperty(property);

      if (!layer) {
        continue;
      }

      var keys = [];

      for (var keyIndex = 0; keyIndex < property.selectedKeys.length; keyIndex += 1) {
        keys.push(property.selectedKeys[keyIndex]);
      }

      targets.push({ property: property, layer: layer, keys: keys });
    }

    return targets;
  }

  function getTargetLayers(targets) {
    var layers = [];

    for (var index = 0; index < targets.length; index += 1) {
      var layer = targets[index].layer;
      var known = false;

      for (var layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        if (layers[layerIndex] === layer) {
          known = true;
        }
      }

      if (!known) {
        layers.push(layer);
      }
    }

    return layers;
  }

  function getTargetRange(target) {
    var start = Infinity;
    var end = -Infinity;

    for (var index = 0; index < target.keys.length; index += 1) {
      var time = target.property.keyTime(target.keys[index]);

      if (time < start) {
        start = time;
      }

      if (time > end) {
        end = time;
      }
    }

    return { start: start, end: end };
  }

  function getRangesForScope(targets, scope) {
    var ranges = [];
    var index = 0;

    if (scope === "property") {
      for (index = 0; index < targets.length; index += 1) {
        var propertyRange = getTargetRange(targets[index]);

        ranges.push({
          targets: [targets[index]],
          start: propertyRange.start,
          end: propertyRange.end
        });
      }

      return ranges;
    }

    if (scope === "layer") {
      var layers = getTargetLayers(targets);

      for (var layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        var layerTargets = [];
        var layerStart = Infinity;
        var layerEnd = -Infinity;

        for (index = 0; index < targets.length; index += 1) {
          if (targets[index].layer !== layers[layerIndex]) {
            continue;
          }

          layerTargets.push(targets[index]);

          var targetRange = getTargetRange(targets[index]);

          if (targetRange.start < layerStart) {
            layerStart = targetRange.start;
          }

          if (targetRange.end > layerEnd) {
            layerEnd = targetRange.end;
          }
        }

        ranges.push({ targets: layerTargets, start: layerStart, end: layerEnd });
      }

      return ranges;
    }

    var globalStart = Infinity;
    var globalEnd = -Infinity;

    for (index = 0; index < targets.length; index += 1) {
      var range = getTargetRange(targets[index]);

      if (range.start < globalStart) {
        globalStart = range.start;
      }

      if (range.end > globalEnd) {
        globalEnd = range.end;
      }
    }

    return [{ targets: targets, start: globalStart, end: globalEnd }];
  }

  function getPropertyPath(property, layer) {
    var path = [];
    var current = property;

    while (current && current !== layer) {
      var parent = current.parentProperty;

      path.unshift({
        matchName: String(current.matchName || ""),
        name: String(current.name || ""),
        isEffect: !!(parent && parent.matchName === "ADBE Effect Parade")
      });

      current = parent;
    }

    return path;
  }

  function getPathKey(path) {
    var key = "";

    for (var index = 0; index < path.length; index += 1) {
      key += "/" + path[index].matchName;
    }

    return key;
  }

  function createSnapshot(property, layer, keyIndex) {
    var snapshot = {
      property: property,
      layer: layer,
      path: getPropertyPath(property, layer),
      time: property.keyTime(keyIndex),
      value: copyArrayValue(property.keyValue(keyIndex)),
      inType: property.keyInInterpolationType(keyIndex),
      outType: property.keyOutInterpolationType(keyIndex),
      inEase: copyEasePoints(property.keyInTemporalEase(keyIndex)),
      outEase: copyEasePoints(property.keyOutTemporalEase(keyIndex)),
      temporalContinuous: false,
      temporalAutoBezier: false,
      spatialContinuous: false,
      spatialAutoBezier: false,
      roving: false,
      inTangent: null,
      outTangent: null,
      sourceInPoint: layer.inPoint,
      sourceOutPoint: layer.outPoint
    };

    try {
      snapshot.temporalContinuous = property.keyTemporalContinuous(keyIndex);
    } catch (error) {
      void error;
    }

    try {
      snapshot.temporalAutoBezier = property.keyTemporalAutoBezier(keyIndex);
    } catch (error) {
      void error;
    }

    try {
      snapshot.spatialContinuous = property.keySpatialContinuous(keyIndex);
    } catch (error) {
      void error;
    }

    try {
      snapshot.spatialAutoBezier = property.keySpatialAutoBezier(keyIndex);
    } catch (error) {
      void error;
    }

    try {
      snapshot.roving = property.keyRoving(keyIndex);
    } catch (error) {
      void error;
    }

    try {
      snapshot.inTangent = copyArrayValue(property.keyInSpatialTangent(keyIndex));
    } catch (error) {
      void error;
    }

    try {
      snapshot.outTangent = copyArrayValue(property.keyOutSpatialTangent(keyIndex));
    } catch (error) {
      void error;
    }

    return snapshot;
  }

  function createTargetSnapshots(target) {
    var snapshots = [];

    for (var index = 0; index < target.keys.length; index += 1) {
      snapshots.push(createSnapshot(target.property, target.layer, target.keys[index]));
    }

    return snapshots;
  }

  function copySnapshotWithValue(snapshot, value) {
    return {
      property: snapshot.property,
      layer: snapshot.layer,
      path: snapshot.path,
      time: snapshot.time,
      value: value,
      inType: snapshot.inType,
      outType: snapshot.outType,
      inEase: snapshot.inEase,
      outEase: snapshot.outEase,
      temporalContinuous: snapshot.temporalContinuous,
      temporalAutoBezier: snapshot.temporalAutoBezier,
      spatialContinuous: snapshot.spatialContinuous,
      spatialAutoBezier: snapshot.spatialAutoBezier,
      roving: snapshot.roving,
      inTangent: snapshot.inTangent,
      outTangent: snapshot.outTangent,
      sourceInPoint: snapshot.sourceInPoint,
      sourceOutPoint: snapshot.sourceOutPoint
    };
  }

  function removeSelectedKeys(targets) {
    for (var index = 0; index < targets.length; index += 1) {
      for (var keyIndex = targets[index].keys.length - 1; keyIndex >= 0; keyIndex -= 1) {
        targets[index].property.removeKey(targets[index].keys[keyIndex]);
      }
    }
  }

  function hasKeyAtTime(property, time) {
    if (!property.numKeys || property.numKeys < 1) {
      return false;
    }

    var index = property.nearestKeyIndex(time);
    return Math.abs(property.keyTime(index) - time) < TIME_EPSILON;
  }

  function removeKeyAtTime(property, time) {
    if (!property.numKeys || property.numKeys < 1) {
      return;
    }

    var index = property.nearestKeyIndex(time);

    if (Math.abs(property.keyTime(index) - time) < TIME_EPSILON) {
      property.removeKey(index);
    }
  }

  function restoreSnapshot(property, snapshot, time, inverted, skipExisting) {
    // A duplicate must never overwrite one of its own source keys when the time
    // cursor sits inside the copied range.
    if (skipExisting && hasKeyAtTime(property, time)) {
      return false;
    }

    var index = property.addKey(time);

    property.setValueAtKey(index, snapshot.value);

    var inType = inverted ? snapshot.outType : snapshot.inType;
    var outType = inverted ? snapshot.inType : snapshot.outType;
    var usesBezier =
      inType === KeyframeInterpolationType.BEZIER ||
      outType === KeyframeInterpolationType.BEZIER;

    // Temporal ease coerces a Linear or Hold key into Bezier, so it is restored
    // only for keys that already used Bezier interpolation.
    if (usesBezier) {
      try {
        property.setTemporalEaseAtKey(
          index,
          toKeyframeEases(
            inverted ? reverseEasePoints(snapshot.outEase) : snapshot.inEase
          ),
          toKeyframeEases(
            inverted ? reverseEasePoints(snapshot.inEase) : snapshot.outEase
          )
        );
      } catch (error) {
        void error;
      }

      try {
        property.setTemporalContinuousAtKey(index, snapshot.temporalContinuous);
      } catch (error) {
        void error;
      }

      try {
        property.setTemporalAutoBezierAtKey(index, snapshot.temporalAutoBezier);
      } catch (error) {
        void error;
      }
    }

    try {
      // Keep this last: it is the authoritative source of the key shape.
      property.setInterpolationTypeAtKey(index, inType, outType);
    } catch (error) {
      void error;
    }

    try {
      property.setSpatialTangentsAtKey(
        index,
        inverted ? snapshot.outTangent : snapshot.inTangent,
        inverted ? snapshot.inTangent : snapshot.outTangent
      );
      property.setSpatialContinuousAtKey(index, snapshot.spatialContinuous);
      property.setSpatialAutoBezierAtKey(index, snapshot.spatialAutoBezier);
      property.setRovingAtKey(index, snapshot.roving);
    } catch (error) {
      void error;
    }

    try {
      property.setSelectedAtKey(index, true);
    } catch (error) {
      void error;
    }

    return true;
  }

  function toSeconds(composition, value, unit) {
    return unit === "frames" ? value * composition.frameDuration : value;
  }

  function roundToFrame(composition, time) {
    return Math.round(time / composition.frameDuration) * composition.frameDuration;
  }

  function shuffle(items) {
    var result = [];
    var index = 0;

    for (index = 0; index < items.length; index += 1) {
      result.push(items[index]);
    }

    for (index = result.length - 1; index > 0; index -= 1) {
      var nextIndex = Math.floor(Math.random() * (index + 1));
      var swapped = result[index];

      result[index] = result[nextIndex];
      result[nextIndex] = swapped;
    }

    return result;
  }

  function isStretchAction(action) {
    return action.indexOf("stretch") === 0;
  }

  function isStaggerAction(action) {
    return (
      action === "staggerDescending" ||
      action === "staggerAscending" ||
      action === "staggerRandom" ||
      action === "interval"
    );
  }

  function retimeTargets(composition, command, targets) {
    var action = command.action;
    var ranges = getRangesForScope(targets, command.scope || "layer");
    var inverted = action === "flip" || action === "duplicateFlip";
    var isDuplicate = action === "duplicate" || action === "duplicateFlip";
    var step = 0;
    var index = 0;

    if (isStaggerAction(action)) {
      if (typeof command.value !== "number" || !isFinite(command.value)) {
        return null;
      }

      step = toSeconds(composition, command.value, command.unit);
    }

    if (isStretchAction(action) && (!command.value || !isFinite(command.value))) {
      return null;
    }

    if (action === "staggerAscending") {
      ranges.reverse();
    }

    if (action === "staggerRandom") {
      ranges = shuffle(ranges);
    }

    var globalStart = ranges[0].start;

    for (index = 0; index < ranges.length; index += 1) {
      if (ranges[index].start < globalStart) {
        globalStart = ranges[index].start;
      }
    }

    var moves = [];

    for (var rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
      var range = ranges[rangeIndex];
      var coefficient = 1;

      if (isStretchAction(action)) {
        if (command.unit === "percent") {
          coefficient = 100 / command.value;
        } else {
          var duration = toSeconds(composition, command.value, command.unit);

          if (duration === 0) {
            return null;
          }

          coefficient = (range.end - range.start) / duration;
        }

        if (!isFinite(coefficient) || coefficient === 0) {
          return null;
        }
      }

      for (var targetIndex = 0; targetIndex < range.targets.length; targetIndex += 1) {
        var snapshots = createTargetSnapshots(range.targets[targetIndex]);

        for (index = 0; index < snapshots.length; index += 1) {
          var snapshot = snapshots[index];
          var time = snapshot.time;

          if (action === "duplicate" || action === "alignFirstKey") {
            time = snapshot.time + (composition.time - range.start);
          } else if (action === "duplicateFlip") {
            time = composition.time + (range.end - snapshot.time);
          } else if (action === "flip") {
            time = range.start + range.end - snapshot.time;
          } else if (action === "alignLastKey") {
            time = snapshot.time + (composition.time - range.end);
          } else if (action === "alignInPoint") {
            time = snapshot.time + (snapshot.layer.inPoint - range.start);
          } else if (action === "alignOutPoint") {
            time = snapshot.time + (snapshot.layer.outPoint - range.end);
          } else if (
            action === "staggerDescending" ||
            action === "staggerAscending" ||
            action === "staggerRandom"
          ) {
            time = snapshot.time + (globalStart + rangeIndex * step - range.start);
          } else if (action === "stretchFirstKey") {
            time = range.start + (snapshot.time - range.start) / coefficient;
          } else if (action === "stretchLastKey") {
            time = range.end + (snapshot.time - range.end) / coefficient;
          } else if (action === "stretchCTI") {
            time = composition.time + (snapshot.time - composition.time) / coefficient;
          } else if (action === "snapFrame") {
            time = roundToFrame(composition, snapshot.time);
          }

          moves.push({ property: snapshot.property, snapshot: snapshot, time: time });
        }
      }
    }

    if (action === "interval") {
      moves = [];

      for (index = 0; index < targets.length; index += 1) {
        var ordered = createTargetSnapshots(targets[index]);

        ordered.sort(function (first, second) {
          return first.time - second.time;
        });

        for (var orderIndex = 0; orderIndex < ordered.length; orderIndex += 1) {
          moves.push({
            property: ordered[orderIndex].property,
            snapshot: ordered[orderIndex],
            time: ordered[0].time + orderIndex * step
          });
        }
      }
    }

    if (!isDuplicate) {
      removeSelectedKeys(targets);
    }

    var restored = 0;

    for (index = 0; index < moves.length; index += 1) {
      if (
        restoreSnapshot(
          moves[index].property,
          moves[index].snapshot,
          moves[index].time,
          inverted,
          isDuplicate
        )
      ) {
        restored += 1;
      }
    }

    return restored;
  }

  function shiftTargets(composition, targets, frames) {
    var moves = [];
    var index = 0;

    for (index = 0; index < targets.length; index += 1) {
      var snapshots = createTargetSnapshots(targets[index]);

      for (var keyIndex = 0; keyIndex < snapshots.length; keyIndex += 1) {
        moves.push({
          property: snapshots[keyIndex].property,
          snapshot: snapshots[keyIndex],
          time: snapshots[keyIndex].time + frames * composition.frameDuration
        });
      }
    }

    removeSelectedKeys(targets);

    var shifted = 0;

    for (index = 0; index < moves.length; index += 1) {
      if (
        restoreSnapshot(
          moves[index].property,
          moves[index].snapshot,
          moves[index].time,
          false,
          false
        )
      ) {
        shifted += 1;
      }
    }

    return shifted;
  }

  function cleanInterval(targets) {
    var removed = 0;

    for (var index = 0; index < targets.length; index += 1) {
      if (targets[index].keys.length < 2) {
        continue;
      }

      var property = targets[index].property;
      var range = getTargetRange(targets[index]);

      for (var keyIndex = property.numKeys; keyIndex >= 1; keyIndex -= 1) {
        var time = property.keyTime(keyIndex);

        if (
          time > range.start + TIME_EPSILON &&
          time < range.end - TIME_EPSILON &&
          !property.keySelected(keyIndex)
        ) {
          property.removeKey(keyIndex);
          removed += 1;
        }
      }
    }

    return removed;
  }

  function setConstantSpeed(targets) {
    var changed = 0;

    for (var index = 0; index < targets.length; index += 1) {
      if (targets[index].keys.length !== 2) {
        return -1;
      }

      var property = targets[index].property;
      var first = targets[index].keys[0];
      var last = targets[index].keys[1];
      var ease = property.keyOutTemporalEase(first);

      if (!ease || ease.length === 0) {
        continue;
      }

      try {
        property.setInterpolationTypeAtKey(
          first,
          KeyframeInterpolationType.BEZIER,
          KeyframeInterpolationType.BEZIER
        );
        property.setInterpolationTypeAtKey(
          last,
          KeyframeInterpolationType.BEZIER,
          KeyframeInterpolationType.BEZIER
        );
        property.setTemporalEaseAtKey(
          first,
          toKeyframeEases(copyEasePoints(ease)),
          toKeyframeEases(copyEasePoints(ease))
        );
        property.setTemporalEaseAtKey(
          last,
          toKeyframeEases(copyEasePoints(ease)),
          toKeyframeEases(copyEasePoints(ease))
        );
        property.setTemporalContinuousAtKey(first, true);
        property.setTemporalContinuousAtKey(last, true);
        changed += 2;
      } catch (error) {
        void error;
      }
    }

    return changed;
  }

  function copySelection(targets) {
    var layers = getTargetLayers(targets);

    if (layers.length !== 1) {
      return resultError("singleLayerRequired");
    }

    var keys = [];
    var earliest = Infinity;

    for (var index = 0; index < targets.length; index += 1) {
      var snapshots = createTargetSnapshots(targets[index]);

      for (var keyIndex = 0; keyIndex < snapshots.length; keyIndex += 1) {
        var snapshot = snapshots[keyIndex];

        // The clipboard outlives the current selection, so it must not keep
        // references to live After Effects objects.
        snapshot.property = null;
        snapshot.layer = null;
        keys.push(snapshot);

        if (snapshot.time < earliest) {
          earliest = snapshot.time;
        }
      }
    }

    global.SequoiaKeyframeClipboard = { keys: keys, earliest: earliest };

    return resultSuccess(keys.length);
  }

  function getPropertyAtPath(layer, path) {
    var current = layer;

    for (var index = 0; index < path.length; index += 1) {
      var part = path[index];
      var next = null;

      try {
        next = current.property(part.matchName);
      } catch (error) {
        void error;
      }

      if (!next) {
        try {
          next = current.property(part.name);
        } catch (error) {
          void error;
        }
      }

      if (!next && part.isEffect && current && current.matchName === "ADBE Effect Parade") {
        try {
          next = current.addProperty(part.matchName);

          if (next) {
            next.name = part.name;
          }
        } catch (error) {
          void error;
        }
      }

      if (!next) {
        return null;
      }

      current = next;
    }

    return current;
  }

  function getValueOffset(base, source) {
    if (typeof base === "number" && typeof source === "number") {
      return base - source;
    }

    if (
      !base ||
      !source ||
      typeof base.length !== "number" ||
      typeof source.length !== "number" ||
      base.length !== source.length
    ) {
      return null;
    }

    var result = [];

    for (var index = 0; index < base.length; index += 1) {
      if (typeof base[index] !== "number" || typeof source[index] !== "number") {
        return null;
      }

      result.push(base[index] - source[index]);
    }

    return result;
  }

  function addValueOffset(value, offset) {
    if (typeof value === "number" && typeof offset === "number") {
      return value + offset;
    }

    if (!value || offset === null || typeof value.length !== "number") {
      return null;
    }

    var result = [];

    for (var index = 0; index < value.length; index += 1) {
      result.push(value[index] + offset[index]);
    }

    return result;
  }

  function getSelectionOrigin(property) {
    var selected = property.selectedKeys || [];

    if (selected.length === 0) {
      return null;
    }

    var earliest = Infinity;

    for (var index = 0; index < selected.length; index += 1) {
      var time = property.keyTime(selected[index]);

      if (time < earliest) {
        earliest = time;
      }
    }

    return earliest;
  }

  function pasteClipboard(composition, command) {
    var clipboard = global.SequoiaKeyframeClipboard;

    if (!clipboard || !clipboard.keys || clipboard.keys.length === 0) {
      return resultError("emptyClipboard");
    }

    var layers = composition.selectedLayers || [];

    if (layers.length === 0) {
      return resultError("noLayerSelection");
    }

    var origin = command.origin || "inPoint";
    var isRelative = command.pasteMode === "relative";
    var pasted = 0;

    for (var layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      var layer = layers[layerIndex];
      var offsets = {};

      for (var keyIndex = 0; keyIndex < clipboard.keys.length; keyIndex += 1) {
        var snapshot = clipboard.keys[keyIndex];
        var property = getPropertyAtPath(layer, snapshot.path);

        if (!property || !property.addKey) {
          continue;
        }

        var time = snapshot.time;

        if (origin === "inPoint") {
          time = layer.inPoint + (snapshot.time - snapshot.sourceInPoint);
        } else if (origin === "outPoint") {
          time = layer.outPoint + (snapshot.time - snapshot.sourceOutPoint);
        } else if (origin === "cti") {
          time = composition.time + (snapshot.time - clipboard.earliest);
        } else {
          var selectionOrigin = getSelectionOrigin(property);

          if (selectionOrigin === null) {
            continue;
          }

          time = selectionOrigin + (snapshot.time - clipboard.earliest);
        }

        if (command.autoUpdate && origin !== "selection") {
          removeKeyAtTime(property, time);
        }

        var restored = snapshot;

        if (isRelative) {
          var offsetKey = getPathKey(snapshot.path);

          if (offsets[offsetKey] === undefined) {
            offsets[offsetKey] = getValueOffset(
              property.valueAtTime(time, true),
              snapshot.value
            );
          }

          var nextValue = addValueOffset(snapshot.value, offsets[offsetKey]);

          if (nextValue === null) {
            return resultError("unsupportedProperty");
          }

          restored = copySnapshotWithValue(snapshot, nextValue);
        }

        if (restoreSnapshot(property, restored, time, false, false)) {
          pasted += 1;
        }
      }
    }

    return pasted > 0 ? resultSuccess(pasted) : resultError("operationFailed");
  }

  function runKeyframeTool(command) {
    var composition = getActiveComposition();

    if (!composition) {
      return resultError("noSelection");
    }

    if (command.action === "paste") {
      app.beginUndoGroup("Sequoia: Paste Keyframes");

      try {
        return pasteClipboard(composition, command);
      } catch (error) {
        void error;
        return resultError("operationFailed");
      } finally {
        app.endUndoGroup();
      }
    }

    var targets = getSelectedTargets(composition);

    if (targets.length === 0) {
      return resultError("noSelection");
    }

    for (var index = 0; index < targets.length; index += 1) {
      if (!isRetimableProperty(targets[index].property)) {
        return resultError("unsupportedProperty");
      }
    }

    if (command.action === "copy") {
      return copySelection(targets);
    }

    app.beginUndoGroup("Sequoia: " + command.action);

    try {
      if (command.action === "intervalClean") {
        return resultSuccess(cleanInterval(targets));
      }

      if (command.action === "constantSpeed") {
        var constant = setConstantSpeed(targets);

        if (constant < 0) {
          return resultError("invalidValue");
        }

        return constant > 0 ? resultSuccess(constant) : resultError("operationFailed");
      }

      if (command.action === "shift") {
        if (typeof command.frames !== "number" || !isFinite(command.frames)) {
          return resultError("invalidValue");
        }

        return resultSuccess(shiftTargets(composition, targets, command.frames));
      }

      var changed = retimeTargets(composition, command, targets);

      if (changed === null) {
        return resultError("invalidValue");
      }

      return changed > 0 ? resultSuccess(changed) : resultError("operationFailed");
    } catch (error) {
      void error;
      return resultError("operationFailed");
    } finally {
      app.endUndoGroup();
    }
  }

  /**
   * Runs one keyframe tool.
   *
   * The arguments are passed positionally because the ExtendScript bridge only
   * carries a plain script string.
   */
  Sequoia.runKeyframeTool = function (
    action,
    scope,
    value,
    unit,
    frames,
    origin,
    pasteMode,
    autoUpdate
  ) {
    return formatResult(
      runKeyframeTool({
        action: String(action || ""),
        scope: scope ? String(scope) : "layer",
        value: typeof value === "number" ? value : Number(value),
        unit: unit ? String(unit) : "",
        frames: typeof frames === "number" ? frames : Number(frames),
        origin: origin ? String(origin) : "",
        pasteMode: pasteMode ? String(pasteMode) : "absolute",
        autoUpdate: autoUpdate === true
      })
    );
  };

  Sequoia.hasKeyframeClipboard = function () {
    var clipboard = global.SequoiaKeyframeClipboard;
    return clipboard && clipboard.keys && clipboard.keys.length > 0 ? "1" : "0";
  };

  global.Sequoia = Sequoia;
})($.global);
