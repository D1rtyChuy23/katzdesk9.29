import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRAINING_TITLE,
  TRAINING_TOPICS,
  countByTopic,
  isTrainingTopic,
  topicLabel,
  trainingFileError,
  trainingFileName,
  trainingMime,
} from "../src/lib/ops/training.ts";

test("Education And Training has the five topics, in order", () => {
  assert.equal(TRAINING_TITLE, "Education And Training");
  assert.deepEqual(
    TRAINING_TOPICS.map((t) => t.label),
    ["Water Specs", "Coffee 101", "Barista 101", "Latte Art", "Importance Of Cleaning"],
  );
  assert.equal(isTrainingTopic("latte-art"), true);
  assert.equal(isTrainingTopic("axiom"), false);
  assert.equal(topicLabel("cleaning"), "Importance Of Cleaning");
  assert.equal(topicLabel("nope"), "");
});

test("a training file keeps its own name: it is never renamed after a machine", () => {
  assert.equal(trainingFileName("Axiom  Cleaning Steps.pdf", []), "Axiom Cleaning Steps.pdf");
  assert.equal(trainingFileName("Coffee 101.pdf", ["coffee 101.pdf"]), "Coffee 101 (2).pdf");
  assert.equal(trainingFileName("Coffee 101.pdf", ["Coffee 101.pdf", "Coffee 101 (2).pdf"]), "Coffee 101 (3).pdf");
});

test("training takes slides as well as what a model book takes", () => {
  assert.equal(trainingMime("Barista 101.pptx"), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.equal(trainingMime("Water.pdf"), "application/pdf");
  assert.equal(trainingFileError("Latte Art.pptx", 1000), null);
  assert.match(trainingFileError("notes.exe", 1000), /can't be added/);
  assert.match(trainingFileError("empty.pdf", 0), /empty/);
  assert.match(trainingFileError("huge.pdf", 21 * 1024 * 1024), /too big/);
});

test("every topic shows, with its count, even when it is empty", () => {
  const counts = countByTopic([{ topic: "coffee-101" }, { topic: "coffee-101" }, { topic: "latte-art" }]);
  assert.deepEqual(counts.map((c) => c.count), [0, 2, 0, 1, 0]);
  assert.equal(counts.length, 5);
});
