/**
 * Shared auto-reaction helpers.
 * Single source of truth for the allowed emoji set + delay timing
 * used by channel, private, and group auto-reactions.
 */

const ALLOWED_EMOJIS = ['💯', '😍', '❤️', '🔥', '⚡️'];

/** Pick one random emoji from the allowed list. */
function randomEmoji() {
  return ALLOWED_EMOJIS[Math.floor(Math.random() * ALLOWED_EMOJIS.length)];
}

/** Async sleep. */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Random delay between 2000-5000ms (inclusive). */
function randomReactDelay() {
  return 2000 + Math.floor(Math.random() * 3001);
}

module.exports = {
  ALLOWED_EMOJIS,
  randomEmoji,
  delay,
  randomReactDelay,
};
