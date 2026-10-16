import { motion, type Variants } from 'motion/react';

const EASE = [0.16, 1, 0.3, 1] as const;

const word: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.65, ease: EASE } },
};

const block: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

function FadeWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((part, i) => (
        <motion.span key={`${part}-${i}`} variants={word} className={className} style={{ display: 'inline-block' }}>
          {part}
          {i < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </>
  );
}

export function HeroWords() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } } }}
    >
      <motion.div variants={block}>
        <motion.h1
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } } }}
          className="font-display text-[2.2rem] sm:text-5xl lg:text-[clamp(2.8rem,4.6vw,3.6rem)] font-semibold leading-[1.06] tracking-tight"
        >
          <FadeWords text="Get grilled by AI" />
          <br />
          <span className="gradient-text">
            <FadeWords text="before investors do." />
          </span>
        </motion.h1>
      </motion.div>
    </motion.div>
  );
}

export { block as heroBlock, EASE as heroEase };
