import { lazy, Suspense, useEffect, useState } from 'react';
import { BookOpen, Bookmark, ClipboardCheck, Languages, PenLine, Trophy } from 'lucide-react';
import { loadDictionary } from './lib/dictionary';
import { filterToChineseAndPunctuation } from './lib/segment';
import { primeVoices } from './lib/speech';
import { deleteSavedPhrase, getSavedPhrases, savePhrase } from './lib/storage';
import { ReaderView } from './components/ReaderView';
import { SavedList } from './components/SavedList';
import { InstallButton } from './components/InstallButton';
import { ErrorBoundary } from './components/ErrorBoundary';
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

  useEffect(() => {
    primeVoices();
    loadDictionary()
      .then(setDict)
      .catch((err: Error) => setDictError(err.message));
  }, []);

  function refreshSaved() {
    setSavedPhrases(getSavedPhrases());
  }

  // Strips stray non-Chinese text (letters, digits) while keeping
  // punctuation and line breaks, wherever Reader's text gets set — typing,
  // pasting, opening a saved phrase, or confirming a camera scan.
  function handleReaderTextChange(text: string) {
    setReaderText(filterToChineseAndPunctuation(text));
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
    deleteSavedPhrase(id);
    refreshSaved();
    if (testPhrase?.id === id) setTestPhrase(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">
          <Languages aria-hidden="true" size={24} /> Chinese Spelling Buddy
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
                onPickPhrase={handleTestPhrase}
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
    </div>
  );
}

export default App;
