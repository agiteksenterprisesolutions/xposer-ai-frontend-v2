// src/components/ui/LanguagePills.jsx
//
// The language choice, offered as tappable replies in the chat itself rather
// than as a form control. It reads as the first turn of the conversation,
// which is what it is: the agent cannot start until the answer is known,
// because the code is baked into the room name before anyone joins.
//
// Laid out right-aligned like the caller's own messages — these are their
// reply, not the assistant's.
import { motion } from 'framer-motion';
import { VOICE_LANGUAGE_OPTIONS } from '../../utils/languages';

const LanguagePills = ({ onSelect, disabled = false }) => (
  <div className="flex flex-wrap justify-end gap-2">
    {VOICE_LANGUAGE_OPTIONS.map((option, index) => {
      return (
        <motion.button
          key={option.code}
          type="button"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          // Staggered so the options arrive as a set rather than snapping in,
          // capped so the last pill is never left waiting.
          transition={{ duration: 0.2, delay: Math.min(index * 0.035, 0.4) }}
          onClick={() => onSelect(option.code)}
          disabled={disabled}
          title={option.native === option.english ? option.native : option.english}
          lang={option.code === 'auto' ? undefined : option.code}
          dir={option.rtl ? 'rtl' : 'auto'}
          className="rounded-full border border-line-accent bg-transparent px-3.5 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {option.native}
        </motion.button>
      );
    })}
  </div>
);

export default LanguagePills;
