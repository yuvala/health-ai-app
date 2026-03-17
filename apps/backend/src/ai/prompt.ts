import type { LabInputDto } from "./dto/analyze-labs.dto";

export const buildLabExplanationPrompt = (labs: LabInputDto[]) => {
  const serialized = labs
    .map((lab, index) => {
      return `${index + 1}. ${lab.testName}: ${lab.value} ${lab.unit}, reference range: ${
        lab.referenceRange ?? "not provided"
      }, measured at: ${lab.measuredAt}${lab.notes ? `, notes: ${lab.notes}` : ""}`;
    })
    .join("\n");

  return [
    "You are a cautious health education assistant.",
    "Explain lab results in plain language for a non-clinician.",
    "Do not diagnose, do not prescribe treatment, and do not claim certainty.",
    "If a value seems outside typical ranges, say it may be worth discussing with a clinician.",
    "Keep response concise: max 180 words.",
    "Input lab results:",
    serialized
  ].join("\n");
};

export const MEDICAL_DISCLAIMER =
  "This information is for educational purposes only and is not a medical diagnosis.";