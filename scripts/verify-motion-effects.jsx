/* oxlint-disable no-unused-vars -- ExtendScript requires a catch binding. */

/**
 * Integration check for the Bounce and Overshoot pseudo-effects.
 *
 * Run it from After Effects with File > Scripts > Run Script File... It builds
 * a throwaway composition, drives the host API the panel calls, and writes a
 * report to /tmp/sequoia-motion-effects-report.txt.
 *
 * It covers what static inspection cannot: that the bundled preset really
 * produces the pseudo-effect, that the child properties carry the expected
 * names, that reapplying preserves the user's values, that Bounce and Overshoot
 * replace each other, and that the legacy Slider Control layout is migrated.
 */
(function () {
  var extensionFolder = new File($.fileName).parent.parent;
  var hostFile = new File(extensionFolder.fsName + "/jsx/host.jsx");
  var reportFile = new File("/tmp/sequoia-motion-effects-report.txt");
  var originalActiveItem = app.project.activeItem;
  var testName = "__SEQUOIA_MOTION_TEST_" + new Date().getTime();
  var testComposition = null;
  var passed = 0;
  var failed = 0;
  var lines = [];

  function record(name, ok, details) {
    if (ok) {
      passed += 1;
      lines.push("PASS | " + name);
    } else {
      failed += 1;
      lines.push("FAIL | " + name + (details ? " | " + details : ""));
    }
  }

  function assert(name, condition, details) {
    record(name, condition === true, details);
  }

  function writeReport() {
    reportFile.encoding = "UTF-8";
    reportFile.open("w");
    reportFile.write(lines.join("\n"));
    reportFile.close();
  }

  function deselectAll(composition) {
    for (var index = 1; index <= composition.numLayers; index += 1) {
      composition.layer(index).selected = false;
    }

    var properties = composition.selectedProperties;

    for (var propertyIndex = 0; propertyIndex < properties.length; propertyIndex += 1) {
      try {
        properties[propertyIndex].selected = false;
      } catch (error) {
        void error;
      }
    }
  }

  function selectOnlyProperty(composition, property) {
    deselectAll(composition);
    property.selected = true;
  }

  function animatedPosition(composition, name) {
    var layer = composition.layers.addSolid([1, 0, 0], name, 100, 100, 1);
    var position = layer.property("ADBE Transform Group").property("ADBE Position");

    position.setValueAtTime(0, [0, 0]);
    position.setValueAtTime(1, [200, 200]);

    return position;
  }

  function findEffect(layer, matchName) {
    var effects = layer.property("ADBE Effect Parade");

    for (var index = 1; index <= effects.numProperties; index += 1) {
      if (effects.property(index).matchName === matchName) {
        return effects.property(index);
      }
    }

    return null;
  }

  function countEffects(layer, matchName) {
    var effects = layer.property("ADBE Effect Parade");
    var total = 0;

    for (var index = 1; index <= effects.numProperties; index += 1) {
      if (effects.property(index).matchName === matchName) {
        total += 1;
      }
    }

    return total;
  }

  var BOUNCE_MATCH = "Pseudo/Sequoia Bounce";
  var OVERSHOOT_MATCH = "Pseudo/Sequoia Overshoot";

  function checkApply(composition) {
    var position = animatedPosition(composition, "bounce-apply");
    var layer = position.propertyGroup(position.propertyDepth);

    selectOnlyProperty(composition, position);
    var result = String(Sequoia.applyBounce());

    assert("applyBounce reports ok|1", result === "ok|1", result);

    var effect = findEffect(layer, BOUNCE_MATCH);
    assert("Bounce pseudo-effect exists", effect !== null);

    if (!effect) {
      return;
    }

    assert(
      "Effect is named after the property",
      effect.name === "Bounce Position",
      effect.name
    );
    assert(
      "Effect bundles three child controls",
      effect.numProperties === 3,
      String(effect.numProperties)
    );
    assert(
      "Child controls are Amount, Duration, Elasticity",
      effect.property(1).name === "Amount" &&
        effect.property(2).name === "Duration" &&
        effect.property(3).name === "Elasticity",
      effect.property(1).name + ", " + effect.property(2).name + ", " +
        effect.property(3).name
    );
    assert(
      "Expression is enabled and error free",
      position.expressionEnabled === true && !position.expressionError,
      position.expressionError
    );
    assert(
      "Only one Bounce effect was created",
      countEffects(layer, BOUNCE_MATCH) === 1,
      String(countEffects(layer, BOUNCE_MATCH))
    );
  }

  function checkReapplyPreservesValues(composition) {
    var position = animatedPosition(composition, "bounce-reapply");
    var layer = position.propertyGroup(position.propertyDepth);

    selectOnlyProperty(composition, position);
    Sequoia.applyBounce();

    var effect = findEffect(layer, BOUNCE_MATCH);

    if (!effect) {
      record("Reapply keeps user values", false, "no effect after first apply");
      return;
    }

    effect.property(1).setValue(42);
    effect.property(2).setValue(3);

    selectOnlyProperty(composition, position);
    var result = String(Sequoia.applyBounce());

    assert("Reapply reports noop", result.indexOf("noop|") === 0, result);

    var after = findEffect(layer, BOUNCE_MATCH);
    assert(
      "Reapply keeps Amount",
      after !== null && after.property(1).value === 42,
      after ? String(after.property(1).value) : "missing"
    );
    assert(
      "Reapply keeps Duration",
      after !== null && after.property(2).value === 3,
      after ? String(after.property(2).value) : "missing"
    );
    assert(
      "Reapply does not duplicate the effect",
      countEffects(layer, BOUNCE_MATCH) === 1,
      String(countEffects(layer, BOUNCE_MATCH))
    );
  }

  function checkMutualReplacement(composition) {
    var position = animatedPosition(composition, "bounce-to-overshoot");
    var layer = position.propertyGroup(position.propertyDepth);

    selectOnlyProperty(composition, position);
    Sequoia.applyBounce();

    selectOnlyProperty(composition, position);
    var result = String(Sequoia.applyOvershoot());

    assert("applyOvershoot reports ok|1", result === "ok|1", result);
    assert(
      "Overshoot replaced the Bounce effect",
      countEffects(layer, BOUNCE_MATCH) === 0,
      String(countEffects(layer, BOUNCE_MATCH))
    );
    assert(
      "Overshoot pseudo-effect exists",
      countEffects(layer, OVERSHOOT_MATCH) === 1,
      String(countEffects(layer, OVERSHOOT_MATCH))
    );
    assert(
      "Overshoot expression is error free",
      !position.expressionError,
      position.expressionError
    );
  }

  function checkSelectionProbe(composition) {
    var position = animatedPosition(composition, "probe");

    selectOnlyProperty(composition, position);
    Sequoia.applyBounce();
    selectOnlyProperty(composition, position);

    var reported = String(Sequoia.getSelectedMotionEffects());
    assert(
      "getSelectedMotionEffects reports bounce",
      reported.indexOf("bounce") !== -1,
      reported
    );

    deselectAll(composition);
    assert(
      "Empty selection reports nothing",
      String(Sequoia.getSelectedMotionEffects()) === "",
      String(Sequoia.getSelectedMotionEffects())
    );
  }

  function checkRemove(composition) {
    var position = animatedPosition(composition, "bounce-remove");
    var layer = position.propertyGroup(position.propertyDepth);

    selectOnlyProperty(composition, position);
    Sequoia.applyBounce();

    selectOnlyProperty(composition, position);
    var result = String(Sequoia.removeSelectedBounce());

    assert("removeSelectedBounce reports ok|1", result === "ok|1", result);
    assert(
      "Effect was removed",
      countEffects(layer, BOUNCE_MATCH) === 0,
      String(countEffects(layer, BOUNCE_MATCH))
    );
    assert("Expression was cleared", position.expression === "", position.expression);
  }

  /**
   * Older builds wrote a `// SEQUOIA_BOUNCE_V1|a|b|c` marker and drove the
   * expression from three Slider Controls. Reapplying has to carry those values
   * into the pseudo-effect and remove the sliders.
   */
  function checkLegacyMigration(composition) {
    var position = animatedPosition(composition, "legacy");
    var layer = position.propertyGroup(position.propertyDepth);
    var effects = layer.property("ADBE Effect Parade");
    var names = ["Bounce Amount L", "Bounce Duration L", "Bounce Elasticity L"];
    var values = [55, 2, 80];

    for (var index = 0; index < names.length; index += 1) {
      var slider = effects.addProperty("ADBE Slider Control");
      slider.name = names[index];
      slider.property(1).setValue(values[index]);
    }

    position.expression =
      "// SEQUOIA_BOUNCE_V1|" + names.join("|") + "\nvalue;";

    selectOnlyProperty(composition, position);
    var result = String(Sequoia.applyBounce());

    assert("Legacy apply reports ok|1", result === "ok|1", result);

    var effect = findEffect(layer, BOUNCE_MATCH);
    assert("Legacy migration created the pseudo-effect", effect !== null);

    if (effect) {
      assert(
        "Legacy Amount was carried over",
        effect.property(1).value === 55,
        String(effect.property(1).value)
      );
      assert(
        "Legacy Duration was carried over",
        effect.property(2).value === 2,
        String(effect.property(2).value)
      );
      assert(
        "Legacy Elasticity was carried over",
        effect.property(3).value === 80,
        String(effect.property(3).value)
      );
    }

    var remainingSliders = 0;

    effects = layer.property("ADBE Effect Parade");

    for (var effectIndex = 1; effectIndex <= effects.numProperties; effectIndex += 1) {
      if (effects.property(effectIndex).matchName === "ADBE Slider Control") {
        remainingSliders += 1;
      }
    }

    assert(
      "Legacy Slider Controls were removed",
      remainingSliders === 0,
      String(remainingSliders)
    );
  }

  if (!hostFile.exists) {
    lines.push("FAIL | host.jsx not found at " + hostFile.fsName);
    writeReport();
    return lines.join("\n");
  }

  $.evalFile(hostFile);

  if (typeof Sequoia === "undefined" || !Sequoia.applyBounce) {
    lines.push("FAIL | Sequoia host API did not load");
    writeReport();
    return lines.join("\n");
  }

  app.beginUndoGroup("Sequoia motion effect verification");

  try {
    testComposition = app.project.items.addComp(testName, 400, 400, 1, 5, 25);
    testComposition.openInViewer();

    checkApply(testComposition);
    checkReapplyPreservesValues(testComposition);
    checkMutualReplacement(testComposition);
    checkSelectionProbe(testComposition);
    checkRemove(testComposition);
    checkLegacyMigration(testComposition);
  } catch (error) {
    record("Integration script", false, error.toString());
  } finally {
    app.endUndoGroup();

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
    "Sequoia Motion Effects - After Effects " + app.version,
    "Passed: " + passed + ", Failed: " + failed,
    ""
  );
  writeReport();
  return lines.join("\n");
})();
