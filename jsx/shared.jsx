/* oxlint-disable no-unused-vars -- ExtendScript requires a catch binding. */

/**
 * Helpers shared by every Sequoia host script.
 *
 * host.jsx loads this first, then loads the tool scripts, so each of them can
 * alias what it needs into a local at the top of its own closure.
 */
(function (global) {
  var SequoiaShared = {};

  SequoiaShared.getActiveComposition = function () {
    var composition = app.project.activeItem;
    return composition instanceof CompItem ? composition : null;
  };

  SequoiaShared.describeError = function (error) {
    return error && error.toString
      ? error.toString()
      : "Unknown After Effects error.";
  };

  SequoiaShared.pushUniqueLayer = function (layers, layer) {
    if (!layer) {
      return;
    }

    for (var index = 0; index < layers.length; index += 1) {
      if (layers[index] === layer) {
        return;
      }
    }

    layers.push(layer);
  };

  /**
   * Every layer the selection touches, whether the user selected the layer
   * itself or one of its properties.
   */
  SequoiaShared.getSelectedLayerList = function (composition) {
    var layers = [];
    var selectedLayers = composition.selectedLayers || [];
    var selectedProperties = composition.selectedProperties || [];

    for (var layerIndex = 0; layerIndex < selectedLayers.length; layerIndex += 1) {
      SequoiaShared.pushUniqueLayer(layers, selectedLayers[layerIndex]);
    }

    for (
      var propertyIndex = 0;
      propertyIndex < selectedProperties.length;
      propertyIndex += 1
    ) {
      try {
        var property = selectedProperties[propertyIndex];
        SequoiaShared.pushUniqueLayer(
          layers,
          property.propertyGroup(property.propertyDepth)
        );
      } catch (error) {
        void error;
      }
    }

    return layers;
  };

  /**
   * `applyPreset` acts on the selection, so the target layer has to be the only
   * thing selected. The previous selection is restored afterwards.
   */
  SequoiaShared.applyPresetToOnlyLayer = function (layer, presetFile) {
    var composition = layer.containingComp;
    var selection = [];

    for (var index = 1; index <= composition.numLayers; index += 1) {
      selection.push(composition.layer(index).selected === true);
    }

    try {
      for (
        var deselectIndex = 1;
        deselectIndex <= composition.numLayers;
        deselectIndex += 1
      ) {
        composition.layer(deselectIndex).selected = false;
      }

      layer.selected = true;
      layer.applyPreset(presetFile);
    } finally {
      for (
        var restoreIndex = 1;
        restoreIndex <= composition.numLayers;
        restoreIndex += 1
      ) {
        composition.layer(restoreIndex).selected = selection[restoreIndex - 1];
      }
    }
  };

  SequoiaShared.resultError = function (reason, details) {
    return {
      ok: false,
      reason: reason || "operationFailed",
      details: details || ""
    };
  };

  SequoiaShared.resultSuccess = function (count, details) {
    return {
      ok: true,
      count: count || 0,
      details: details || ""
    };
  };

  SequoiaShared.resultPartial = function (count, details) {
    return {
      ok: true,
      partial: true,
      count: count || 0,
      details: details || ""
    };
  };

  /**
   * Renders a result in the panel's wire format: `ok|count`, `noop|count`,
   * `partial|count|details` or `error|message`.
   *
   * `describeReason` turns a script's own reason code into a sentence, so each
   * tool script keeps its own vocabulary.
   */
  SequoiaShared.formatResult = function (result, describeReason) {
    if (result && result.ok) {
      if (result.partial) {
        return "partial|" + result.count + "|" + result.details;
      }

      return result.count > 0 ? "ok|" + result.count : "noop|0";
    }

    var reason = result ? result.reason : "operationFailed";
    var message =
      result && result.details ? result.details : describeReason(reason);

    return "error|" + message;
  };

  global.SequoiaShared = SequoiaShared;
})($.global);
