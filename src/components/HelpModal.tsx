import { BookOpen, Bookmark, ClipboardCheck, PenLine, Trophy, X } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

const TAB_GUIDE = [
  {
    icon: BookOpen,
    name: 'Reader',
    description:
      'Paste or type a Chinese phrase to see its pinyin. Tap any word for its meaning, use Read aloud to hear it, or Scan a list to bring in text from a photo of a worksheet. Tap Save to my list to keep it for later.',
  },
  {
    icon: Bookmark,
    name: 'My List',
    description: 'Everything you saved from Reader, grouped by day. Tap a word to see its meaning again, or delete it.',
  },
  {
    icon: PenLine,
    name: 'Practise',
    description: 'Pick a saved phrase and practise writing each character by hand, stroke by stroke, with hints if you get stuck.',
  },
  {
    icon: ClipboardCheck,
    name: 'Test',
    description:
      'Pick saved words or sentences, listen to the audio, try to recall the meaning, then mark whether you knew it. Tricky words come back for another try.',
  },
  {
    icon: Trophy,
    name: 'Progress',
    description: "See your XP, streaks, and badges, based on how your Practise and Test sessions have gone.",
  },
];

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-panel help-panel">
        <div className="detail-header">
          <h2 className="help-title">How this app works</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="help-intro">
          Paste a Chinese phrase into <strong>Reader</strong>, tap words to learn their meaning, and save the ones you
          want to come back to. Then use <strong>Practise</strong> to learn handwriting or <strong>Test</strong> to
          check what you remember — <strong>Progress</strong> tracks how you're doing over time.
        </p>
        <ul className="help-tab-list">
          {TAB_GUIDE.map(({ icon: Icon, name, description }) => (
            <li key={name} className="help-tab-item">
              <Icon size={20} aria-hidden="true" className="help-tab-icon" />
              <div>
                <strong>{name}</strong>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
