// Lightweight first-pass content filter. It is deliberately small: it blocks direct abuse
// and routes crisis language to support resources. Reports + auto-hide catch the rest.

const ABUSE_PATTERNS = [
  /\bkill\s+your\s*self\b/i,
  /\bkys\b/i,
  /\bgo\s+die\b/i,
  /\bi(?:'ll| will)\s+(?:kill|hurt|find)\s+you\b/i,
  /\bn[i1]gg(?:er|a)s?\b/i,
  /\bf[a4]gg?(?:ot)?s?\b/i,
  /\bretard(?:ed|s)?\b/i,
  /\bk[i1]ke\b/i,
  /\bsp[i1]c\b/i,
  /\bch[i1]nk\b/i,
  /\btr[a4]nn(?:y|ie)s?\b/i,
  /\bwh[o0]re\b/i,
  /\bsl[u*]t\b/i,
  /\bc[u*]nt\b/i,
];

const CRISIS_PATTERNS = [
  /\bkill(?:ing)?\s+my\s*self\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend(?:ing)?\s+(?:my|it)\s+(?:life|all)\b/i,
  /\b(?:don'?t|do not)\s+want\s+to\s+(?:live|be alive|be here anymore)\b/i,
  /\bself[\s-]?harm\b/i,
  /\b(?:cut|cutting|hurt|hurting)\s+my\s*self\b/i,
  /\boverdos(?:e|ing)\b/i,
];

export const CRISIS_MESSAGE =
  "It sounds like you might be going through something really heavy. Decidr isn't the right place " +
  'for this one — please reach out to someone who can help right now. In the US you can call or text 988 ' +
  '(Suicide & Crisis Lifeline); elsewhere, findahelpline.com lists free local services. ' +
  'If you are in immediate danger, call your local emergency number.';

export function containsAbuse(...texts) {
  return texts.some((text) => text && ABUSE_PATTERNS.some((pattern) => pattern.test(text)));
}

export function containsCrisisLanguage(...texts) {
  return texts.some((text) => text && CRISIS_PATTERNS.some((pattern) => pattern.test(text)));
}
