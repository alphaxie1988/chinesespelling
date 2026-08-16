import { lazy, Suspense, useEffect, useState } from 'react';
import { BookOpen, Bookmark, ClipboardCheck, Info, Languages, PenLine, Trophy } from 'lucide-react';
import { loadDictionary } from './lib/dictionary';
import { filterToChineseAndPunctuation } from './lib/segment';
import { primeVoices } from './lib/speech';
import { deleteSavedPhrase, getSavedPhrases, restoreSavedPhrase, savePhrase } from './lib/storage';
import { ReaderView } from './components/ReaderView';
import { SavedList } from './components/SavedList';
import { InstallButton } from './components/InstallButton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HelpModal } from './components/HelpModal';
import { Toast } from './components/Toast';
import type { Dictionary, SavedPhrase, ViewName } from './types';
import './App.css';

// A tab left open across a new deploy still holds index.html referencing
// hashed chunk filenames that no longer exist on the server once a newer
// build replaces them, so the dynamic import() below 404s the moment the
// user first navigates to that tab — this is what actually produced the
// "goes blank on Practise, need to refresh" reports. A stale-chunk failure
// isn't recoverable in place (the JS just isn't there), so the fix is a
// one-time automatic reload to pick up the current index.html/chunks;
// `sessionReloadedFor` guards against a genuine, repeatable load failure
// (e.g. offline) causing a refresh loop.
function withChunkReload<T>(modulePromise: Promise<T>): Promise<T> {
  return modulePromise
    .then((mod) => {
      sessionStorage.removeItem('chunk-reload-attempted');
      return mod;
    })
    .catch((err) => {
      if (!sessionStorage.getItem('chunk-reload-attempted')) {
        sessionStorage.setItem('chunk-reload-attempted', '1');
        window.location.reload();
        return new Promise<T>(() => {}); // page is reloading; never resolve
      }
      throw err;
    });
}

// hanzi-writer (stroke-order rendering + quiz grading) is only needed once
// the user opens Write Test mode, so it's split into its own chunk instead
// of bloating the initial bundle every visitor downloads.
const TestMode = lazy(() =>
  withChunkReload(import('./components/TestMode').then((m) => ({ default: m.TestMode }))),
);
const RecallMode = lazy(() =>
  withChunkReload(import('./components/RecallMode').then((m) => ({ default: m.RecallMode }))),
);
const ProgressView = lazy(() =>
  withChunkReload(import('./components/ProgressView').then((m) => ({ default: m.ProgressView }))),
);

function App() {
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [dictError, setDictError] = useState<string | null>(null);
  const [view, setView] = useState<ViewName>('reader');
  const [readerText, setReaderText] = useState('');
  const [testPhrase, setTestPhrase] = useState<SavedPhrase | null>(null);
  const [savedPhrases, setSavedPhrases] = useState<SavedPhrase[]>(() => getSavedPhrases());
  const [showHelp, setShowHelp] = useState(false);
  const [deleteToast, setDeleteToast] = useState<{ phrase: SavedPhrase; index: number } | null>(null);

  useEffect(() => {
    primeVoices();
    loadDictionary()
      .then(setDict)
      .catch((err: Error) => setDictError(err.message));
  }, []);

  // Singapore National Day (9 August) seasonal theme — red and white for
  // the whole month, reverting automatically once September starts.
  const isSgNationalDay = new Date().getMonth() === 7;
  useEffect(() => {
    if (isSgNationalDay) {
      document.documentElement.dataset.theme = 'sg-national-day';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshSaved() {
    setSavedPhrases(getSavedPhrases());
  }

  // Wherever Reader's text gets set — typing, pasting, opening a saved
  // phrase, or confirming a camera scan — spaces (half- or full-width)
  // become line breaks, so a space-separated word list gets the same
  // per-line treatment as one word per line already does. Runs before
  // filterToChineseAndPunctuation strips stray non-Chinese text (letters,
  // digits), which leaves punctuation and line breaks alone either way.
  function handleReaderTextChange(text: string) {
    setReaderText(filterToChineseAndPunctuation(text.replace(/[ 　]+/g, '\n')));
  }

  function handleSave(text: string) {
    savePhrase(text);
    refreshSaved();
  }

  function handleOpenInReader(text: string) {
    handleReaderTextChange(text);
    setView('reader');
  }

  function handleTestPhrase(phrase: SavedPhrase | null) {
    setTestPhrase(phrase);
    setView('test');
  }

  function handleDelete(id: string) {
    const index = savedPhrases.findIndex((p) => p.id === id);
    const phrase = savedPhrases[index];
    deleteSavedPhrase(id);
    refreshSaved();
    if (testPhrase?.id === id) setTestPhrase(null);
    if (phrase) setDeleteToast({ phrase, index });
  }

  function handleUndoDelete() {
    if (!deleteToast) return;
    restoreSavedPhrase(deleteToast.phrase, deleteToast.index);
    refreshSaved();
    setDeleteToast(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="icon-btn app-help-btn"
          onClick={() => setShowHelp(true)}
          aria-label="How this app works"
        >
          <Info size={20} aria-hidden="true" />
        </button>
        <h1 className="app-title">
          <Languages aria-hidden="true" size={24} /> Chinese Spelling Buddy
          {isSgNationalDay && (
            <span role="img" aria-label="Singapore flag" title="Happy National Day, Singapore!">
              🇸🇬
            </span>
          )}
        </h1>
        <nav className="app-nav">
          <button
            type="button"
            className={`nav-btn ${view === 'reader' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('reader')}
          >
            <BookOpen size={19} aria-hidden="true" />
            <span className="nav-label">Reader</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${view === 'saved' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('saved')}
          >
            <Bookmark size={19} aria-hidden="true" />
            <span className="nav-label">My List</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${view === 'test' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('test')}
          >
            <PenLine size={19} aria-hidden="true" />
            <span className="nav-label">Practise</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${view === 'recall' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('recall')}
          >
            <ClipboardCheck size={19} aria-hidden="true" />
            <span className="nav-label">Test</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${view === 'progress' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('progress')}
          >
            <Trophy size={19} aria-hidden="true" />
            <span className="nav-label">Progress</span>
          </button>
        </nav>
        <InstallButton />
      </header>

      <main className="app-main">
        {dictError && (
          <p className="error-state">
            Couldn't load the dictionary ({dictError}). Check your connection and reload the page.
          </p>
        )}

        {!dict && !dictError && <p className="loading-state">Loading dictionary…</p>}

        <ErrorBoundary key={view}>
          {dict && view === 'reader' && (
            <ReaderView dict={dict} text={readerText} onTextChange={handleReaderTextChange} onSave={handleSave} />
          )}

          {dict && view === 'saved' && (
            <SavedList phrases={savedPhrases} dict={dict} onOpen={handleOpenInReader} onDelete={handleDelete} />
          )}

          {view === 'test' && (
            <Suspense fallback={<p className="loading-state">Loading Practise…</p>}>
              <TestMode
                savedPhrases={savedPhrases}
                phrase={testPhrase}
                dict={dict}
                onPickPhrase={handleTestPhrase}
                onOpenInReader={handleOpenInReader}
                onGoToReader={() => setView('reader')}
              />
            </Suspense>
          )}

          {dict && view === 'recall' && (
            <Suspense fallback={<p className="loading-state">Loading Test…</p>}>
              <RecallMode savedPhrases={savedPhrases} dict={dict} onGoToReader={() => setView('reader')} />
            </Suspense>
          )}

          {view === 'progress' && (
            <Suspense fallback={<p className="loading-state">Loading progress…</p>}>
              <ProgressView />
            </Suspense>
          )}
        </ErrorBoundary>
      </main>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {deleteToast && (
        <Toast
          key={deleteToast.phrase.id}
          message={`Deleted "${deleteToast.phrase.text}"`}
          actionLabel="Undo"
          onAction={handleUndoDelete}
          onDismiss={() => setDeleteToast(null)}
        />
      )}
    </div>
  );
}

export default App;
