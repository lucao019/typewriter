import { DragEvent, useEffect, useState } from 'react';
import { AUDIO_EXTENSIONS, getAudioDurationEstimate } from '../modules/audio';

type NavKey = 'home' | 'new' | 'queue' | 'history' | 'models' | 'settings' | 'logs';

type AudioItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  duration: string;
  path?: string;
  transcript?: string;
  status?: 'idle' | 'processing' | 'done' | 'error';
};

const navItems: Array<{ key: NavKey; label: string; icon: string }> = [
  { key: 'home', label: 'Início', icon: '◈' },
  { key: 'new', label: 'Nova transcrição', icon: '＋' },
  { key: 'queue', label: 'Fila de processamento', icon: '▣' },
  { key: 'history', label: 'Histórico', icon: '◫' },
  { key: 'models', label: 'Modelos de IA', icon: '◌' },
  { key: 'settings', label: 'Configurações', icon: '⚙' },
  { key: 'logs', label: 'Logs e diagnóstico', icon: '◍' },
];

const formatBytes = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>('new');
  const [files, setFiles] = useState<AudioItem[]>([]);
  const [version, setVersion] = useState<string>('0.1.0');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    void window.lucao.app.getVersion()
      .then((appVersion) => {
        if (mounted) setVersion(appVersion);
      })
      .catch(() => {
        if (mounted) setVersion('0.1.0');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const addFiles = (fileList: Array<{ name: string; size: number; type: string; path?: string }>) => {
    const nextFiles: AudioItem[] = [];
    const seen = new Map<string, AudioItem>();

    fileList.forEach((file) => {
      const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';

      if (!AUDIO_EXTENSIONS.includes(extension)) {
        return;
      }

      const duplicateKey = `${file.name}-${file.size}`;
      if (seen.has(duplicateKey) || files.some((current) => current.name === file.name && current.size === file.size)) {
        return;
      }

      seen.set(duplicateKey, {
        id: `${file.name}-${file.size}-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type || extension,
        duration: getAudioDurationEstimate(file.name),
        path: file.path,
        status: 'idle',
      });
    });

    for (const item of seen.values()) {
      nextFiles.push(item);
    }

    if (nextFiles.length > 0) {
      setFiles((current) => [...current, ...nextFiles]);
    }
  };

  const handleSelectFiles = async () => {
    try {
      const selectedFiles = await window.lucao.app.selectAudioFiles();
      addFiles(selectedFiles);
      if (selectedFiles.length > 0) setStatusMessage('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível abrir o seletor de arquivos.';
      setStatusMessage(message);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      setStatusMessage('Para transcrever, use “Selecionar arquivos” e escolha o áudio pelo seletor do aplicativo.');
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles((current) => current.filter((file) => file.id !== id));
  };

  const handleTranscribeFiles = async () => {
    if (files.length === 0) {
      setStatusMessage('Selecione ao menos um arquivo de áudio antes de transcrever.');
      return;
    }

    const pendingFiles = files.filter((file) => file.path && file.status !== 'done');
    if (pendingFiles.length === 0) {
      setStatusMessage(files.every((file) => file.status === 'done') ? 'Todos os arquivos já foram transcritos.' : 'Use “Selecionar arquivos” para importar o áudio pelo seletor do aplicativo.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Preparando transcrição local...');

    try {
      const results = await Promise.all(
        pendingFiles.map(async (file) => {
          setFiles((current) => current.map((item) => (item.id === file.id ? { ...item, status: 'processing', transcript: undefined } : item)));

          const result = await window.lucao.transcriptions.transcribe(file.path!, { language: 'pt-BR', model: 'small' });
          setFiles((current) => current.map((item) => (item.id === file.id ? { ...item, status: 'done', transcript: result.transcript } : item)));
          return result;
        }),
      );

      const totalWords = results.reduce((count, item) => count + item.transcript.split(/\s+/).filter(Boolean).length, 0);
      setStatusMessage(`Transcrição concluída para ${results.length} arquivo(s). ${totalWords} palavras processadas.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível concluir a transcrição.';
      setStatusMessage(message);
      setFiles((current) => current.map((item) => (item.status === 'processing' ? { ...item, status: 'error' } : item)));
    } finally {
      setIsProcessing(false);
    }
  };

  const activeModule = navItems.find((item) => item.key === activeNav)?.label ?? 'Início';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <strong>LUCAO</strong>
            <span>Audio Transcriber</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
              onClick={() => setActiveNav(item.key)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span>Versão</span>
          <strong>{version}</strong>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Módulo</p>
            <h1>{activeModule}</h1>
          </div>
        </header>

        {activeNav === 'new' && (
          <>
            <div
              className={`panel hero-panel ${isDragging ? 'dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div>
                <h2>Preparação de arquivos de áudio</h2>
                <p>
                  Use o seletor do aplicativo para importar múltiplos arquivos em WAV, MP3,
                  M4A, AAC, FLAC, OGG, OPUS e WEBM.
                </p>
              </div>
              <button type="button" className="primary" onClick={() => void handleSelectFiles()}>
                Selecionar arquivos
              </button>
            </div>

            <section className="panel queue-panel">
              <div className="panel-header">
                <h3>Lista de áudio</h3>
                <div className="panel-actions">
                  <span>{files.length} itens</span>
                  <button type="button" className="primary small" onClick={handleTranscribeFiles} disabled={isProcessing || files.length === 0}>
                    {isProcessing ? 'Transcrevendo...' : 'Transcrever'}
                  </button>
                </div>
              </div>
              {statusMessage && <div className="status-banner">{statusMessage}</div>}
              {files.length === 0 ? (
                <div className="empty-state">Nenhum arquivo adicionado ainda.</div>
              ) : (
                <ul className="file-list">
                  {files.map((file) => (
                    <li key={file.id}>
                      <div className="file-meta">
                        <strong>{file.name}</strong>
                        <small>
                          {file.type.toUpperCase()} · {formatBytes(file.size)} · {file.duration}
                        </small>
                        {file.transcript && <p className="transcript-preview">{file.transcript}</p>}
                      </div>
                      <div className="file-actions">
                        <span className={`file-status ${file.status ?? 'idle'}`}>{file.status === 'done' ? 'Concluído' : file.status === 'processing' ? 'Processando' : file.status === 'error' ? 'Erro' : 'Em espera'}</span>
                        <button type="button" onClick={() => handleRemoveFile(file.id)}>
                          Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="summary-grid">
              <article className="panel stat-card">
                <span>Arquivos válidos</span>
                <strong>{files.length}</strong>
                <small>Prontos para transcrever</small>
              </article>
              <article className="panel stat-card accent">
                <span>Modelo</span>
                <strong>small</strong>
                <small>Português (BR) · local</small>
              </article>
              <article className="panel stat-card success">
                <span>Processamento</span>
                <strong>{files.length > 0 ? '52%' : '0%'}</strong>
                <small>{files.length > 0 ? '1 de 2 tarefas em andamento' : 'Aguardando entrada'}</small>
              </article>
            </section>
          </>
        )}

        {activeNav !== 'new' && (
          <section className="panel module-panel">
            <h2>{activeModule}</h2>
            <p>
              Este módulo permanece preparado para evoluir com lógica específica do fluxo de {activeModule.toLowerCase()}.
            </p>
            <div className="module-placeholder">
              <span>Próxima etapa:</span>
              <strong>Integrar lógica funcional real deste módulo.</strong>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
