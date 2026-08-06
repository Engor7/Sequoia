/* oxlint-disable no-unused-vars -- ExtendScript requires a catch binding. */
(function () {
  var extensionFolder = new File($.fileName).parent.parent;
  var hostFile = new File(extensionFolder.fsName + "/jsx/host.jsx");
  var reportFile = new File("/tmp/sequoia-easing-tools-report.txt");
  var originalActiveItem = app.project.activeItem;
  var testComposition = null;
  var testName = "__SEQUOIA_EASING_TEST_" + new Date().getTime();
  var passed = 0;
  var failed = 0;
  var lines = [];

  function writeReport() {
    reportFile.encoding = "UTF-8";
    reportFile.open("w");
    reportFile.write(lines.join("\n"));
    reportFile.close();
  }

  function record(name, ok, details) {
    if (ok) {
      passed += 1;
      lines.push("PASS | " + name + (details ? " | " + details : ""));
    } else {
      failed += 1;
      lines.push("FAIL | " + name + (details ? " | " + details : ""));
    }
  }

  function assert(name, condition, details) {
    record(name, condition === true, condition ? "" : details);
  }

  function isOk(result) {
    return /^ok\|[1-9]\d*$/.test(String(result));
  }

  function closeEnough(first, second, epsilon) {
    return Math.abs(first - second) <= (epsilon || 0.01);
  }

  function deselectAll(composition) {
    for (var index = 1; index <= composition.numLayers; index += 1) {
      composition.layer(index).selected = false;
    }
  }

  function selectOnly(composition, layers) {
    deselectAll(composition);

    for (var index = 0; index < layers.length; index += 1) {
      layers[index].selected = true;
    }
  }

  function addRectangleGroup(shapeLayer, name, size, color) {
    var root = shapeLayer.property("ADBE Root Vectors Group");
    var group = root.addProperty("ADBE Vector Group");
    group.name = name;
    var contents = group.property("ADBE Vectors Group");
    var rectangle = contents.addProperty("ADBE Vector Shape - Rect");
    rectangle.property("ADBE Vector Rect Size").setValue(size);
    var fill = contents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(color);
    return { group: group, fill: fill };
  }

  function addPathLayer(composition, name) {
    var layer = composition.layers.addShape();
    layer.name = name;
    var root = layer.property("ADBE Root Vectors Group");
    var group = root.addProperty("ADBE Vector Group");
    group.name = "Path Group";
    var contents = group.property("ADBE Vectors Group");
    var pathGroup = contents.addProperty("ADBE Vector Shape - Group");
    pathGroup.name = "Path 1";
    var path = pathGroup.property("ADBE Vector Shape");
    var shape = new Shape();
    shape.vertices = [[0, 0], [120, 0], [60, 90]];
    shape.inTangents = [[0, 0], [0, 0], [0, 0]];
    shape.outTangents = [[0, 0], [0, 0], [0, 0]];
    shape.closed = true;
    path.setValue(shape);
    return { layer: layer, path: path };
  }

  function countLayersWithPrefix(composition, prefix) {
    var count = 0;

    for (var index = 1; index <= composition.numLayers; index += 1) {
      if (composition.layer(index).name.indexOf(prefix) === 0) {
        count += 1;
      }
    }

    return count;
  }

  function findLayerByName(composition, name) {
    for (var index = 1; index <= composition.numLayers; index += 1) {
      if (composition.layer(index).name === name) {
        return composition.layer(index);
      }
    }

    return null;
  }

  function findShapeFill(layer, groupName) {
    try {
      var root = layer.property("ADBE Root Vectors Group");
      var group = root ? root.property(groupName) : null;
      var contents = group ? group.property("ADBE Vectors Group") : null;
      var fill = contents ? contents.property("ADBE Vector Graphic - Fill") : null;
      return fill ? fill.property("ADBE Vector Fill Color") : null;
    } catch (error) {
      return null;
    }
  }

  function expressionIsHealthy(property) {
    try {
      return property.expressionEnabled === true && !property.expressionError;
    } catch (error) {
      return false;
    }
  }

  function runTransformChecks(composition) {
    var layer = composition.layers.addSolid(
      [1, 0, 0],
      "Transform Target",
      100,
      50,
      1,
      composition.duration
    );
    selectOnly(composition, [layer]);
    var scale = layer.property("ADBE Transform Group").property("ADBE Scale");

    var flipHorizontal = Sequoia.flipSelectedLayers("horizontal");
    assert(
      "Flip Horizontal result",
      isOk(flipHorizontal),
      String(flipHorizontal)
    );
    assert(
      "Flip Horizontal scale",
      closeEnough(scale.value[0], -100) && closeEnough(scale.value[1], 100),
      String(scale.value)
    );

    var flipVertical = Sequoia.flipSelectedLayers("vertical");
    assert(
      "Flip Vertical result",
      isOk(flipVertical),
      String(flipVertical)
    );
    assert(
      "Flip Vertical scale",
      closeEnough(scale.value[0], -100) && closeEnough(scale.value[1], -100),
      String(scale.value)
    );

    var fitWidth = Sequoia.fitSelectedLayers("width");
    assert("Fit Width result", isOk(fitWidth), String(fitWidth));
    assert(
      "Fit Width scale",
      closeEnough(scale.value[0], -640) && closeEnough(scale.value[1], -640),
      String(scale.value)
    );

    var fitHeight = Sequoia.fitSelectedLayers("height");
    assert("Fit Height result", isOk(fitHeight), String(fitHeight));
    assert(
      "Fit Height scale",
      closeEnough(scale.value[0], -720) && closeEnough(scale.value[1], -720),
      String(scale.value)
    );
  }

  function runExplodeMergeChecks(composition) {
    var layer = composition.layers.addShape();
    layer.name = "Explode Source";
    addRectangleGroup(layer, "First", [80, 60], [1, 0, 0, 1]);
    addRectangleGroup(layer, "Second", [50, 40], [0, 0, 1, 1]);
    selectOnly(composition, [layer]);

    var explode = Sequoia.explodeExtractShapes(false);
    assert("Explode result", isOk(explode), String(explode));
    assert(
      "Explode creates two selected layers",
      composition.selectedLayers.length === 2,
      "selected=" + composition.selectedLayers.length
    );

    var merge = Sequoia.mergeShapes(true);
    assert("Merge Shape Layers result", isOk(merge), String(merge));
    assert(
      "Merge creates one selected Shape Layer",
      composition.selectedLayers.length === 1 &&
        !!composition.selectedLayers[0].property("ADBE Root Vectors Group"),
      "selected=" + composition.selectedLayers.length
    );

    var extractSource = composition.layers.addShape();
    extractSource.name = "Extract Source";
    addRectangleGroup(
      extractSource,
      "Selected Figure",
      [40, 40],
      [1, 1, 0, 1]
    );
    addRectangleGroup(
      extractSource,
      "Remaining Figure",
      [30, 30],
      [0, 1, 1, 1]
    );
    selectOnly(composition, [extractSource]);
    extractSource
      .property("ADBE Root Vectors Group")
      .property(1)
      .selected = true;

    var extract = Sequoia.explodeExtractShapes(true);
    assert("Alt Extract selected figure result", isOk(extract), String(extract));
    var remainingSource = findLayerByName(composition, "Extract Source");
    assert(
      "Alt Extract keeps unselected source content",
      remainingSource &&
        remainingSource.property("ADBE Root Vectors Group").numProperties === 1,
      remainingSource
        ? "remaining=" +
          remainingSource.property("ADBE Root Vectors Group").numProperties
        : "source layer was removed"
    );

    var groupMergeSource = composition.layers.addShape();
    groupMergeSource.name = "Group Merge Source";
    addRectangleGroup(
      groupMergeSource,
      "Merge First",
      [45, 30],
      [1, 0, 1, 1]
    );
    addRectangleGroup(
      groupMergeSource,
      "Merge Second",
      [35, 55],
      [0, 1, 0, 1]
    );
    selectOnly(composition, [groupMergeSource]);
    groupMergeSource
      .property("ADBE Root Vectors Group")
      .property(1)
      .selected = true;
    groupMergeSource
      .property("ADBE Root Vectors Group")
      .property(2)
      .selected = true;
    var groupMerge = Sequoia.mergeShapes(false);
    assert("Merge selected shape-groups result", isOk(groupMerge), String(groupMerge));
    assert(
      "Merge selected shape-groups creates Shape Layer",
      composition.selectedLayers.length === 1 &&
        !!composition.selectedLayers[0].property("ADBE Root Vectors Group"),
      "no merged Shape Layer"
    );

    var convertSource = composition.layers.addText("Explode Convert");
    convertSource.name = "Explode Convert Source";
    selectOnly(composition, [convertSource]);
    var convertExtract = Sequoia.explodeExtractShapes(true);
    assert(
      "Alt Explode converts non-shape source result",
      isOk(convertExtract),
      String(convertExtract)
    );
    assert(
      "Alt Explode removes converted source",
      findLayerByName(composition, "Explode Convert Source") === null,
      "source layer remains"
    );
  }

  function runNullChecks(composition) {
    var first = composition.layers.addSolid(
      [1, 1, 1],
      "Null First",
      20,
      20,
      1,
      composition.duration
    );
    var second = composition.layers.addSolid(
      [1, 1, 1],
      "Null Second",
      20,
      20,
      1,
      composition.duration
    );
    first.property("ADBE Transform Group").property("ADBE Position").setValue([100, 100]);
    second.property("ADBE Transform Group").property("ADBE Position").setValue([300, 200]);
    selectOnly(composition, [first, second]);

    var centered = Sequoia.createNullControllers(false, false);
    assert("Centered Null result", isOk(centered), String(centered));
    assert(
      "Centered Null parents selection",
      first.parent === second.parent && first.parent !== null,
      "parents differ"
    );
    var centerPosition = first.parent
      .property("ADBE Transform Group")
      .property("ADBE Position").value;
    assert(
      "Centered Null position",
      closeEnough(centerPosition[0], 200) && closeEnough(centerPosition[1], 150),
      String(centerPosition)
    );

    var third = composition.layers.addSolid(
      [1, 1, 1],
      "Null Third",
      20,
      20,
      1,
      composition.duration
    );
    var fourth = composition.layers.addSolid(
      [1, 1, 1],
      "Null Fourth",
      20,
      20,
      1,
      composition.duration
    );
    selectOnly(composition, [third, fourth]);
    var separate = Sequoia.createNullControllers(false, true);
    assert("Shift Nulls result", isOk(separate), String(separate));
    assert(
      "Shift Nulls create distinct parents",
      third.parent !== null && fourth.parent !== null && third.parent !== fourth.parent,
      "parents missing or identical"
    );

    var fifth = composition.layers.addSolid(
      [1, 1, 1],
      "Null Fifth",
      20,
      20,
      1,
      composition.duration
    );
    selectOnly(composition, [fifth]);
    var standard = Sequoia.createNullControllers(true, false);
    assert("Alt Standard Null result", isOk(standard), String(standard));
    var standardPosition = fifth.parent
      .property("ADBE Transform Group")
      .property("ADBE Position").value;
    assert(
      "Alt Standard Null keeps AE default center",
      closeEnough(standardPosition[0], composition.width / 2) &&
        closeEnough(standardPosition[1], composition.height / 2),
      String(standardPosition)
    );
  }

  function runPathNullChecks(composition) {
    var followsPath = addPathLayer(composition, "Null Follows Path");
    selectOnly(composition, [followsPath.layer]);
    followsPath.path.selected = true;
    var nullsFollow = Sequoia.linkPathNulls(false);
    assert("Path Nulls result", isOk(nullsFollow), String(nullsFollow));
    assert(
      "Path Nulls create one Null per vertex",
      composition.selectedLayers.length === 3,
      "selected=" + composition.selectedLayers.length
    );

    for (var index = 0; index < composition.selectedLayers.length; index += 1) {
      var position = composition.selectedLayers[index]
        .property("ADBE Transform Group")
        .property("ADBE Position");
      assert(
        "Path Null expression " + (index + 1),
        expressionIsHealthy(position),
        position.expressionError
      );
    }

    var pathFollows = addPathLayer(composition, "Path Follows Nulls");
    selectOnly(composition, [pathFollows.layer]);
    pathFollows.path.selected = true;
    var pathFollowResult = Sequoia.linkPathNulls(true);
    assert(
      "Alt Path follows Nulls result",
      isOk(pathFollowResult),
      String(pathFollowResult)
    );
    assert(
      "Alt Path expression is healthy",
      expressionIsHealthy(pathFollows.path),
      pathFollows.path.expressionError
    );
  }

  function runColorChecks(composition) {
    var layer = composition.layers.addShape();
    layer.name = "Color Source";
    addRectangleGroup(
      layer,
      "Red One",
      [80, 80],
      [1, 0, 0, 1]
    );
    addRectangleGroup(
      layer,
      "Red Two",
      [60, 60],
      [1, 0, 0, 1]
    );
    addRectangleGroup(
      layer,
      "Blue",
      [40, 40],
      [0, 0, 1, 1]
    );
    selectOnly(composition, [layer]);

    var colorResult = Sequoia.createColorControls();
    assert("Color Controls result", isOk(colorResult), String(colorResult));
    assert(
      "Color Controls creates one selected palette",
      composition.selectedLayers.length === 1,
      "selected=" + composition.selectedLayers.length
    );

    var controller = composition.selectedLayers[0];
    var effects = controller.property("ADBE Effect Parade");
    var effect = effects ? effects.property(1) : null;
    assert(
      "Color Controls pseudo-effect match name",
      effect && effect.matchName === "Pseudo/SQ Color Controls 02",
      effect ? effect.matchName : "missing effect"
    );

    if (!effect) {
      record(
        "Color Controls remaining checks",
        false,
        "pseudo-effect was not created"
      );
      return;
    }

    assert(
      "Color Controls visible child names",
      effect &&
        effect.property(1).name === "Color" &&
        effect.property(2).name === "Color 02",
      "unexpected child controls"
    );
    assert(
      "Color Controls links matching fills",
      expressionIsHealthy(
        findShapeFill(findLayerByName(composition, "Color Source"), "Red One")
      ) &&
        expressionIsHealthy(
          findShapeFill(findLayerByName(composition, "Color Source"), "Red Two")
        ) &&
        expressionIsHealthy(
          findShapeFill(findLayerByName(composition, "Color Source"), "Blue")
        ),
      "one or more Fill expressions failed"
    );

    effect.property(1).setValue([0, 1, 0, 1]);
    var paletteCountBefore = countLayersWithPrefix(composition, "Color Controls");
    selectOnly(composition, [findLayerByName(composition, "Color Source")]);
    var reapplied = Sequoia.createColorControls();
    var paletteCountAfter = countLayersWithPrefix(composition, "Color Controls");
    var reappliedController = composition.selectedLayers[0];
    var reappliedEffect = reappliedController
      .property("ADBE Effect Parade")
      .property(1);
    assert("Color Controls reapply result", isOk(reapplied), String(reapplied));
    assert(
      "Color Controls reuses palette on reapply",
      paletteCountBefore === paletteCountAfter,
      paletteCountBefore + " -> " + paletteCountAfter
    );
    assert(
      "Color Controls preserves edited value",
      closeEnough(reappliedEffect.property(1).value[0], 0) &&
        closeEnough(reappliedEffect.property(1).value[1], 1),
      String(reappliedEffect.property(1).value)
    );

  }

  function runVectorChecks(composition) {
    var text = composition.layers.addText("Vector Test");
    text.name = "Vector Source";
    selectOnly(composition, [text]);
    var convert = Sequoia.convertVectorToShape(false, false);
    assert("Vector to Shape result", isOk(convert), String(convert));
    assert(
      "Vector to Shape creates Shape Layer",
      composition.selectedLayers.length === 1 &&
        !!composition.selectedLayers[0].property("ADBE Root Vectors Group"),
      "no selected Shape Layer"
    );

    var removeText = composition.layers.addText("Remove Source");
    removeText.name = "Vector Remove Source";
    selectOnly(composition, [removeText]);
    var removeSource = Sequoia.convertVectorToShape(true, false);
    assert("Alt Vector to Shape result", isOk(removeSource), String(removeSource));
    assert(
      "Alt Vector to Shape removes source",
      findLayerByName(composition, "Vector Remove Source") === null,
      "source layer remains"
    );

    var shiftText = composition.layers.addText("Clean Source");
    shiftText.name = "Vector Shift Source";
    selectOnly(composition, [shiftText]);
    var shiftConvert = Sequoia.convertVectorToShape(false, true);
    assert(
      "Shift Vector to Shape result",
      isOk(shiftConvert),
      String(shiftConvert)
    );
  }

  app.beginUndoGroup("Sequoia Easing Tools Integration Test");

  try {
    if (!hostFile.exists) {
      throw new Error("host.jsx was not found.");
    }

    $.evalFile(hostFile);
    testComposition = app.project.items.addComp(
      testName,
      640,
      360,
      1,
      5,
      30
    );
    testComposition.openInViewer();

    runTransformChecks(testComposition);
    runExplodeMergeChecks(testComposition);
    runNullChecks(testComposition);
    runPathNullChecks(testComposition);
    runColorChecks(testComposition);
    runVectorChecks(testComposition);
  } catch (error) {
    record("Integration script", false, error.toString());
  } finally {
    app.endUndoGroup();

    try {
      app.executeCommand(16);
    } catch (error) {
      lines.push("WARN | Undo failed | " + error.toString());
    }

    try {
      for (var itemIndex = app.project.numItems; itemIndex >= 1; itemIndex -= 1) {
        if (app.project.item(itemIndex).name === testName) {
          app.project.item(itemIndex).remove();
        }
      }
    } catch (error) {
      lines.push("WARN | Temporary composition cleanup failed | " + error.toString());
    }

    try {
      if (originalActiveItem instanceof CompItem) {
        originalActiveItem.openInViewer();
      }
    } catch (error) {
      lines.push("WARN | Original viewer restore failed | " + error.toString());
    }
  }

  lines.unshift(
    "Sequoia Easing Tools - After Effects " + app.version,
    "Passed: " + passed + ", Failed: " + failed,
    ""
  );
  writeReport();
  return lines.join("\n");
})();
