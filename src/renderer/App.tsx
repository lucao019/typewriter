import { DragEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AUDIO_EXTENSIONS, formatAudioDuration } from '../modules/audio';
import type { AudioFile, AudioFileStatus } from '../modules/files';
import type { AppLog } from '../modules/database/store';
import type { AppSettings } from '../modules/settings';
import type { WhisperModel } from '../modules/transcription';
import type { ModelStatus } from '../preload';

type NavKey = 'home' | 'new' | 'queue' | 'history' | 'models' | 'settings' | 'logs';
type AudioItem = AudioFile & { duration: string };
type HistoryFilter = 'all' | 'done' | 'error' | 'cancelled';
type HistoryPeriod = 'all' | '7' | '30';
type Diagnostics = Awaited<ReturnType<typeof window.lucao.diagnostics.check>>;

const navGroups: Array<{ title: string; items: Array<{ key: NavKey; label: string; icon: string }> }> = [
  {
    title: 'WORKSPACE',
    items: [
      { key: 'home', label: 'Início', icon: '⌂' },
      { key: 'new', label: 'Nova transcrição', icon: '+' },
      { key: 'queue', label: 'Fila de processamento', icon: '≡' },
      { key: 'history', label: 'Histórico', icon: '◷' },
    ],
  },
  {
    title: 'SISTEMA',
    items: [
      { key: 'models', label: 'Modelos de IA', icon: '◉' },
      { key: 'settings', label: 'Configurações', icon: '⚙' },
      { key: 'logs', label: 'Logs e diagnóstico', icon: '⌁' },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);
const asAudioItem = (file: AudioFile): AudioItem => ({
  ...file,
  duration: formatAudioDuration(file.durationSeconds),
});

const formatBytes = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (date: string) => new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const statusLabel: Record<AudioFileStatus, string> = {
  waiting: 'Aguardando',
  queued: 'Na fila',
  processing: 'Processando',
  done: 'Concluído',
  error: 'Falhou',
  cancelled: 'Cancelado',
};

const statusClass: Record<AudioFileStatus, string> = {
  waiting: 'waiting',
  queued: 'queued',
  processing: 'processing',
  done: 'done',
  error: 'error',
  cancelled: 'cancelled',
};

function StatusBadge({ status }: { status: AudioFileStatus }) {
  return <span className={`file-status ${statusClass[status]}`}>{statusLabel[status]}</span>;
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('lucao-sidebar-collapsed') === 'true');
  const [files, setFiles] = useState<AudioItem[]>([]);
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [version, setVersion] = useState('0.1.0');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<WhisperModel>('small');
  const [selectedLanguage, setSelectedLanguage] = useState('pt-BR');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('all');
  const [logQuery, setLogQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | AppLog['level']>('all');
  const [selectedTranscript, setSelectedTranscript] = useState<AudioItem | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const refreshFiles = async () => setFiles((await window.lucao.files.getAll()).map(asAudioItem));
  const refreshHistory = async () => setHistory((await window.lucao.transcriptions.history()).map(asAudioItem));
  const refreshModels = async () => setModels(await window.lucao.models.list());
  const refreshDiagnostics = async () => {
    const result = await window.lucao.diagnostics.check();
    setDiagnostics(result);
    setEngineReady(result.ffmpeg && result.whisper && result.model.installed);
  };
  const refreshLogs = async () => setLogs(await window.lucao.logs.list());
  const refreshWorkspace = async () => {
    await Promise.all([refreshFiles(), refreshHistory(), refreshModels(), refreshDiagnostics()]);
  };

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      window.lucao.app.getVersion(),
      window.lucao.settings.get(),
      window.lucao.files.getAll(),
      window.lucao.transcriptions.history(),
      window.lucao.models.list(),
      window.lucao.diagnostics.check(),
    ]).then(([appVersion, savedSettings, savedFiles, savedHistory, savedModels, checks]) => {
      if (!mounted) return;
      setVersion(appVersion);
      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
      setSelectedModel(savedSettings.defaultModel as WhisperModel);
      setSelectedLanguage(savedSettings.defaultLanguage);
      setFiles(savedFiles.map(asAudioItem));
      setHistory(savedHistory.map(asAudioItem));
      setModels(savedModels);
      setDiagnostics(checks);
      setEngineReady(checks.ffmpeg && checks.whisper && checks.model.installed);
    }).catch((error: unknown) => {
      if (mounted) setStatusMessage(error instanceof Error ? error.message : 'Não foi possível carregar os dados do aplicativo.');
    });

    const unsubscribe = window.lucao.transcriptions.onProgress(({ filePath, progressPercent }) => {
      setFiles((current) => current.map((file) => file.path === filePath ? { ...file, progressPercent } : file));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (activeNav !== 'logs') return;
    void refreshLogs().catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Não foi possível carregar os logs.'));
    const timer = window.setInterval(() => {
      void refreshLogs().catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Não foi possível atualizar os logs.'));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeNav]);

  useEffect(() => {
    if (!isProcessing) return;
    const timer = window.setInterval(() => {
      void refreshFiles().catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a fila.'));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  const handleSelectFiles = async (droppedFiles?: FileList) => {
    setIsBusy(true);
    try {
      const selected = droppedFiles
        ? await window.lucao.app.getDroppedAudioFiles(Array.from(droppedFiles))
        : await window.lucao.app.selectAudioFiles();
      let added = 0;
      for (const file of selected) {
        const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
        if (!AUDIO_EXTENSIONS.includes(extension)) continue;
        await window.lucao.files.add(file);
        added += 1;
      }
      await refreshFiles();
      setSelectedPaths((current) => Array.from(new Set([...current, ...selected.map((file) => file.path)])));
      setStatusMessage(added ? `${added} arquivo(s) adicionado(s) à fila.` : selected.length ? 'Os arquivos selecionados não têm formato de áudio suportado.' : '');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível importar os arquivos.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveFile = async (filePath: string) => {
    try {
      await window.lucao.files.remove(filePath);
      setSelectedPaths((current) => current.filter((selected) => selected !== filePath));
      await Promise.all([refreshFiles(), refreshHistory()]);
      setStatusMessage('Arquivo removido da fila.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível remover o arquivo.');
    }
  };

  const handleClearCompleted = async () => {
    const count = files.filter((file) => file.status === 'done' || file.status === 'cancelled').length;
    if (!count) {
      setStatusMessage('Não há tarefas concluídas para limpar da fila.');
      return;
    }
    if (!window.confirm(`Remover ${count} tarefa(s) concluída(s) da fila? O histórico será preservado.`)) return;
    try {
      const removed = await window.lucao.files.clearCompleted();
      await refreshFiles();
      setStatusMessage(`${removed} tarefa(s) removida(s) da fila; o histórico foi preservado.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível limpar as tarefas concluídas.');
    }
  };

  const handleClearPending = async () => {
    const count = files.filter((file) => file.status === 'waiting' || file.status === 'queued').length;
    if (!count) {
      setStatusMessage('Não há tarefas pendentes para remover.');
      return;
    }
    if (!window.confirm(`Remover ${count} arquivo(s) pendente(s) da fila? Transcrições concluídas não serão afetadas.`)) return;
    try {
      const removed = await window.lucao.files.clearPending();
      setSelectedPaths([]);
      await refreshFiles();
      setStatusMessage(`${removed} tarefa(s) pendente(s) removida(s).`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível limpar as tarefas pendentes.');
    }
  };

  const handleTranscribeFiles = async (requestedPaths = selectedPaths) => {
    if (isBusy || isProcessing) return;
    const pendingFiles = files.filter((file) => requestedPaths.includes(file.path) && file.status !== 'done' && file.status !== 'processing');
    if (!pendingFiles.length) {
      setStatusMessage('Selecione arquivos pendentes ou com falha para iniciar a transcrição.');
      return;
    }
    setIsProcessing(true);
    setStatusMessage(`Processando ${pendingFiles.length} arquivo(s) em sequência...`);
    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    let totalWords = 0;
    const failures: string[] = [];

    try {
      for (const file of pendingFiles) {
        setFiles((current) => current.map((item) => item.path === file.path ? { ...item, status: 'processing', progressPercent: 0, transcript: undefined, error: undefined } : item));
        try {
          const result = await window.lucao.transcriptions.transcribe(file.path, {
            language: selectedLanguage === 'auto' ? 'pt-BR' : selectedLanguage,
            autoDetectLanguage: selectedLanguage === 'auto',
            model: selectedModel,
          });
          totalWords += result.transcript.split(/\s+/).filter(Boolean).length;
          completed += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Falha desconhecida na transcrição.';
          if (message !== 'Transcrição cancelada.') {
            failed += 1;
            failures.push(`${file.name}: ${message}`);
          } else cancelled += 1;
        }
      }
      await Promise.all([refreshFiles(), refreshHistory(), refreshDiagnostics()]);
      setStatusMessage(failed
        ? `${completed} concluída(s), ${failed} com falha. ${totalWords} palavras. ${failures[0]}`
        : cancelled
          ? `${completed} concluída(s), ${cancelled} cancelada(s). ${totalWords} palavras processadas.`
          : `Transcrição concluída para ${completed} arquivo(s). ${totalWords} palavras processadas.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o estado das transcrições.');
    } finally {
      setIsProcessing(false);
      setSelectedPaths([]);
    }
  };

  const handleCancelTranscription = async (filePath: string) => {
    try {
      const cancelled = await window.lucao.transcriptions.cancel(filePath);
      setStatusMessage(cancelled ? 'Solicitação de cancelamento enviada.' : 'Não há uma transcrição ativa para cancelar.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível cancelar a transcrição.');
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft) return;
    setIsBusy(true);
    try {
      const saved = await window.lucao.settings.save(settingsDraft);
      setSettings(saved);
      setSettingsDraft(saved);
      setSelectedModel(saved.defaultModel as WhisperModel);
      setSelectedLanguage(saved.defaultLanguage);
      await Promise.all([refreshModels(), refreshDiagnostics()]);
      setStatusMessage('Configurações salvas neste computador.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleChooseDirectory = async (key: 'inputFolder' | 'outputFolder' | 'modelsFolder') => {
    try {
      const folder = await window.lucao.app.selectDirectory();
      if (folder) setSettingsDraft((current) => current ? { ...current, [key]: folder } : current);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível selecionar a pasta.');
    }
  };

  const handleResetSettings = async () => {
    if (!window.confirm('Restaurar as configurações padrão?')) return;
    try {
      const defaults = await window.lucao.settings.save({
        defaultLanguage: 'pt-BR',
        defaultModel: 'small',
        inputFolder: '',
        outputFolder: '',
        modelsFolder: '',
        maxConcurrentTasks: 1,
        keepTemporaryFiles: false,
        openOutputAfterExport: true,
        startWithWindows: false,
        logLevel: 'info',
      });
      setSettings(defaults);
      setSettingsDraft(defaults);
      setSelectedModel('small');
      setSelectedLanguage('pt-BR');
      setStatusMessage('Configurações padrão restauradas.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível restaurar as configurações.');
    }
  };

  const handleSelectModel = async (model: WhisperModel) => {
    const entry = models.find((item) => item.value === model);
    if (!entry?.installed) {
      setStatusMessage(`O modelo ${model} não está instalado. Use o setup local documentado para instalar modelos compatíveis.`);
      return;
    }
    try {
      const saved = await window.lucao.settings.save({ defaultModel: model });
      setSettings(saved);
      setSettingsDraft(saved);
      setSelectedModel(model);
      await refreshModels();
      setStatusMessage(`Modelo ${entry.label} selecionado.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível selecionar o modelo.');
    }
  };

  const handleDeleteHistory = async (file: AudioItem) => {
    if (!window.confirm(`Excluir permanentemente o registro de "${file.name}" do histórico?`)) return;
    try {
      await window.lucao.transcriptions.deleteHistory(file.path);
      setSelectedTranscript(null);
      await Promise.all([refreshHistory(), refreshFiles()]);
      setStatusMessage('Registro excluído do histórico.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível excluir o registro.');
    }
  };

  const handleExportTranscript = async (file: AudioItem) => {
    if (!file.transcript) {
      setStatusMessage('Este registro não contém texto para exportar.');
      return;
    }
    try {
      const savedPath = await window.lucao.transcriptions.exportText(file.path, file.transcript);
      if (!savedPath) {
        setStatusMessage('Exportação cancelada.');
        return;
      }
      if (settings?.openOutputAfterExport) await window.lucao.app.openPath(savedPath);
      setStatusMessage(`Transcrição exportada para ${savedPath}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível exportar a transcrição.');
    }
  };

  const handleCopyTranscript = async (file: AudioItem) => {
    if (!file.transcript) return;
    try {
      await navigator.clipboard.writeText(file.transcript);
      setStatusMessage('Texto copiado para a área de transferência.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível copiar o texto.');
    }
  };

  const handleExportLogs = async () => {
    try {
      const savedPath = await window.lucao.logs.export();
      setStatusMessage(savedPath ? `Logs exportados para ${savedPath}` : 'Exportação de logs cancelada.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível exportar os logs.');
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Apagar todos os logs locais? Esta ação não pode ser desfeita.')) return;
    try {
      await window.lucao.logs.clear();
      await refreshLogs();
      setStatusMessage('Logs apagados.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível apagar os logs.');
    }
  };

  const filteredHistory = useMemo(() => history
    .filter((file) => historyFilter === 'all' || file.status === historyFilter)
    .filter((file) => historyPeriod === 'all' || Date.now() - new Date(file.updatedAt).getTime() <= Number(historyPeriod) * 24 * 60 * 60 * 1000)
    .filter((file) => `${file.name} ${file.transcript ?? ''}`.toLowerCase().includes(historyQuery.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [history, historyFilter, historyPeriod, historyQuery]);

  const filteredLogs = useMemo(() => logs
    .filter((log) => logFilter === 'all' || log.level === logFilter)
    .filter((log) => `${log.message} ${log.details ?? ''}`.toLowerCase().includes(logQuery.toLowerCase())), [logs, logFilter, logQuery]);

  const title = navItems.find((item) => item.key === activeNav)?.label ?? 'Início';
  const pendingCount = files.filter((file) => file.status === 'waiting' || file.status === 'queued').length;
  const completedCount = history.filter((file) => file.status === 'done').length;
  const errorCount = history.filter((file) => file.status === 'error').length;
  const processedCount = history.length;
  const updateSettingsDraft = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettingsDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const handleReprocessHistoryFile = async (file: AudioItem) => {
    if (isBusy || isProcessing) return;
    setIsBusy(true);
    setIsProcessing(true);
    try {
      await window.lucao.files.add({ path: file.path, name: file.name, size: file.size, type: file.type });
      await refreshFiles();
      await window.lucao.transcriptions.transcribe(file.path, {
        language: selectedLanguage === 'auto' ? 'pt-BR' : selectedLanguage,
        autoDetectLanguage: selectedLanguage === 'auto',
        model: selectedModel,
      });
      await Promise.all([refreshFiles(), refreshHistory()]);
      setStatusMessage(`Reprocessamento de ${file.name} concluído.`);
    } catch (error) {
      await Promise.all([refreshFiles(), refreshHistory()]);
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível reprocessar o arquivo.');
    } finally {
      setIsBusy(false);
      setIsProcessing(false);
    }
  };

  const renderFileRow = (file: AudioItem, actions: ReactNode) => (
    <li key={file.path} className="file-row">
      <div className="file-meta">
        <strong>{file.name}</strong>
        <small>{file.type.replace('.', '').toUpperCase()} · {formatBytes(file.size)} · {file.duration} · {file.model}</small>
        {file.status === 'processing' && (
          <div className="progress-track" aria-label={`Progresso ${file.progressPercent ?? 0}%`}>
            <span style={{ width: `${file.progressPercent ?? 0}%` }} />
          </div>
        )}
        {file.transcript && <p className="transcript-preview">{file.transcript}</p>}
        {file.error && <p className="file-error">{file.error}</p>}
      </div>
      <div className="file-actions"><StatusBadge status={file.status} />{actions}</div>
    </li>
  );

  const renderHome = () => (
    <div className="page-content">
      <section className="summary-grid">
        <article className="panel stat-card"><span>Transcrições concluídas</span><strong>{completedCount}</strong><small>Registros persistidos</small></article>
        <article className="panel stat-card"><span>Arquivos processados</span><strong>{processedCount}</strong><small>Inclui falhas e cancelamentos</small></article>
        <article className="panel stat-card"><span>Tarefas pendentes</span><strong>{pendingCount}</strong><small>Aguardando processamento</small></article>
        <article className="panel stat-card"><span>Com erro</span><strong>{errorCount}</strong><small>Verifique a mensagem da tarefa</small></article>
        <article className="panel stat-card accent"><span>Modelo selecionado</span><strong>{settings?.defaultModel ?? '—'}</strong><small>{engineReady ? 'Motor local pronto' : 'Verifique o diagnóstico'}</small></article>
      </section>
      <section className="panel">
        <div className="panel-header"><div><h2>Transcrições recentes</h2><p className="muted">Histórico armazenado neste computador</p></div><button type="button" onClick={() => setActiveNav('history')}>Abrir histórico</button></div>
        {history.length ? <ul className="file-list">{history.slice(0, 5).map((file) => renderFileRow(file, <button type="button" onClick={() => setSelectedTranscript(file)}>Abrir</button>))}</ul> : <div className="empty-state">Ainda não há transcrições concluídas.</div>}
        <div className="engine-status"><span className={`engine-dot ${engineReady ? 'online' : 'offline'}`} />{engineReady ? 'Motor local disponível' : 'Motor ou modelo não disponível'}{diagnostics?.model.modelPath && <small>{diagnostics.model.modelPath}</small>}</div>
      </section>
    </div>
  );

  const renderNew = () => (
    <div className="page-content">
      <div className={`panel hero-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); void handleSelectFiles(event.dataTransfer.files); }}>
        <div><h2>Adicionar áudio</h2><p>Selecione ou solte arquivos WAV, MP3, M4A, AAC, FLAC, OGG, OPUS ou WEBM. O processamento permanece local.</p></div>
        <button type="button" className="primary" onClick={() => void handleSelectFiles()} disabled={isBusy}>{isBusy ? 'Importando...' : 'Selecionar arquivos'}</button>
      </div>
      <section className="panel queue-panel">
        <div className="panel-header"><div><h2>Arquivos para transcrever</h2><p className="muted">{files.length} arquivo(s) na fila</p></div><div className="panel-actions"><label className="inline-select">Modelo<select value={selectedModel} onChange={(event) => void handleSelectModel(event.target.value as WhisperModel)} disabled={isProcessing || isBusy}>{models.map((model) => <option key={model.value} value={model.value} disabled={!model.installed}>{model.label}{model.installed ? '' : ' — não instalado'}</option>)}</select></label><label className="inline-select">Idioma<select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value)} disabled={isProcessing || isBusy}><option value="pt-BR">Português (Brasil)</option><option value="en">Inglês</option><option value="auto">Detecção automática</option></select></label><button type="button" onClick={() => setSelectedPaths(files.map((file) => file.path))} disabled={!files.length || isProcessing || isBusy}>Selecionar todos</button><button type="button" onClick={() => void handleClearPending()} disabled={isProcessing || isBusy}>Limpar pendentes</button><button type="button" className="primary small" onClick={() => void handleTranscribeFiles()} disabled={isProcessing || isBusy || !selectedPaths.length}>{isProcessing ? 'Transcrevendo...' : 'Iniciar selecionados'}</button></div></div>
        {files.length ? <ul className="file-list">{files.map((file) => renderFileRow(file, <><input type="checkbox" aria-label={`Selecionar ${file.name}`} checked={selectedPaths.includes(file.path)} disabled={isProcessing || isBusy} onChange={(event) => setSelectedPaths((current) => event.target.checked ? [...current, file.path] : current.filter((path) => path !== file.path))} /><button type="button" className="danger-quiet" onClick={() => void handleRemoveFile(file.path)} disabled={file.status === 'processing' || isProcessing || isBusy}>Remover</button></>))}</ul> : <div className="empty-state">Nenhum arquivo adicionado. Use o seletor ou arraste arquivos para esta área.</div>}
      </section>
    </div>
  );

  const renderQueue = () => {
    const activeFiles = files.filter((file) => file.status === 'waiting' || file.status === 'queued' || file.status === 'processing' || file.status === 'error');
    return <section className="panel queue-panel"><div className="panel-header"><div><h2>Fila de processamento</h2><p className="muted">{pendingCount} aguardando · execução sequencial</p></div><div className="panel-actions"><button type="button" onClick={() => void handleClearCompleted()} disabled={isBusy || isProcessing}>Limpar concluídas</button><button type="button" className="primary small" onClick={() => void handleTranscribeFiles(activeFiles.filter((file) => file.status !== 'processing').map((file) => file.path))} disabled={isProcessing || isBusy || !activeFiles.some((file) => file.status !== 'processing')}>Iniciar fila</button></div></div>
      {activeFiles.length ? <ul className="file-list">{activeFiles.map((file) => renderFileRow(file, <>{file.status === 'processing' ? <button type="button" onClick={() => void handleCancelTranscription(file.path)}>Cancelar</button> : <button type="button" onClick={() => void handleTranscribeFiles([file.path])} disabled={isProcessing}>{file.status === 'error' ? 'Tentar novamente' : 'Iniciar'}</button>}<button type="button" className="danger-quiet" onClick={() => void handleRemoveFile(file.path)} disabled={file.status === 'processing'}>Remover</button></>))}</ul> : <div className="empty-state">A fila está vazia. Importe um áudio em “Nova transcrição”.</div>}</section>;
  };

  const renderHistory = () => (
    <section className="panel queue-panel"><div className="panel-header"><div><h2>Histórico</h2><p className="muted">{history.length} registro(s) persistidos · exportação SRT/VTT indisponível sem timestamps segmentados</p></div><div className="panel-actions"><input aria-label="Buscar histórico" placeholder="Buscar nome ou texto" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} /><select aria-label="Filtrar por estado" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as HistoryFilter)}><option value="all">Todos os estados</option><option value="done">Concluídas</option><option value="error">Com erro</option><option value="cancelled">Canceladas</option></select><select aria-label="Filtrar período" value={historyPeriod} onChange={(event) => setHistoryPeriod(event.target.value as HistoryPeriod)}><option value="all">Qualquer data</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></div></div>
    {filteredHistory.length ? <ul className="file-list">{filteredHistory.map((file) => renderFileRow(file, <><button type="button" onClick={() => setSelectedTranscript(file)} disabled={!file.transcript}>Abrir</button>{file.transcript && <><button type="button" onClick={() => void handleCopyTranscript(file)}>Copiar</button><button type="button" onClick={() => void handleExportTranscript(file)}>Exportar TXT</button></>}{file.resultPath && <button type="button" onClick={() => void window.lucao.app.openPath(file.resultPath!).catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Não foi possível abrir o resultado.'))}>Abrir TXT</button>}<button type="button" onClick={() => void handleReprocessHistoryFile(file)} disabled={isBusy || isProcessing}>{file.status === 'error' ? 'Tentar novamente' : 'Reprocessar'}</button><button type="button" className="danger-quiet" onClick={() => void handleDeleteHistory(file)}>Excluir</button></>))}</ul> : <div className="empty-state">Nenhum registro corresponde ao filtro atual.</div>}</section>
  );

  const renderModels = () => (
    <div className="page-content"><section className="panel"><div className="panel-header"><div><h2>Modelos Whisper locais</h2><p className="muted">A disponibilidade é verificada nos arquivos do computador.</p></div><button type="button" onClick={() => void refreshModels().then(refreshDiagnostics)}>Verificar novamente</button></div>
      <div className="model-grid">{models.map((model) => <article className={`model-card ${model.selected ? 'selected' : ''}`} key={model.value}><div className="model-heading"><h3>{model.label}</h3><StatusBadge status={model.installed ? 'done' : 'waiting'} /></div><p>{model.speed} · {model.precision}</p><small>Memória estimada: {model.memoryMb} MB</small><small>Arquivo: {model.modelPath ?? 'Não encontrado'}</small><button type="button" className={model.selected ? 'primary small' : 'small'} onClick={() => void handleSelectModel(model.value)} disabled={!model.installed || model.selected}>{model.selected ? 'Selecionado' : model.installed ? 'Selecionar modelo' : 'Não instalado'}</button></article>)}</div>
      <p className="muted">O app não baixa modelos pela interface. Use o instalador local documentado para instalar whisper.cpp e o modelo small; modelos que não estiverem no disco não são marcados como disponíveis.</p>
    </section></div>
  );

  const renderSettings = () => settingsDraft && (
    <div className="page-content">
      <section className="panel settings-section">
        <div><h2>Transcrição</h2><p className="muted">Preferências aplicadas às próximas tarefas. Salvas localmente.</p></div>
        <label>Modelo padrão<select value={settingsDraft.defaultModel} onChange={(event) => updateSettingsDraft('defaultModel', event.target.value)}>{models.map((model) => <option key={model.value} value={model.value} disabled={!model.installed}>{model.label}{model.installed ? '' : ' — não instalado'}</option>)}</select></label>
        <label>Idioma do áudio<select value={settingsDraft.defaultLanguage} onChange={(event) => updateSettingsDraft('defaultLanguage', event.target.value)}><option value="pt-BR">Português (Brasil)</option><option value="en">Inglês</option><option value="auto">Detecção automática</option></select></label>
        <label className="check-setting"><input type="checkbox" checked={settingsDraft.keepTemporaryFiles} onChange={(event) => updateSettingsDraft('keepTemporaryFiles', event.target.checked)} /> Manter o WAV temporário após a transcrição</label>
        <label className="check-setting"><input type="checkbox" checked={settingsDraft.openOutputAfterExport} onChange={(event) => updateSettingsDraft('openOutputAfterExport', event.target.checked)} /> Abrir o TXT após exportar</label>
        <label className="check-setting"><input type="checkbox" checked={settingsDraft.startWithWindows} onChange={(event) => updateSettingsDraft('startWithWindows', event.target.checked)} /> Iniciar com o Windows</label>
        <label>Nível mínimo de log<select value={settingsDraft.logLevel} onChange={(event) => updateSettingsDraft('logLevel', event.target.value as AppSettings['logLevel'])}><option value="debug">Detalhado</option><option value="info">Informação</option><option value="warn">Avisos</option><option value="error">Somente erros</option></select></label>
      </section>
      <section className="panel settings-section">
        <div><h2>Armazenamento</h2><p className="muted">Os registros ficam no diretório local de dados do app.</p></div>
        {(['inputFolder', 'outputFolder', 'modelsFolder'] as const).map((key) => <div className="directory-row" key={key}><label>{key === 'inputFolder' ? 'Pasta de entrada' : key === 'outputFolder' ? 'Pasta de exportação' : 'Pasta de modelos'}<input readOnly value={settingsDraft[key] || 'Padrão do sistema'} /></label><button type="button" onClick={() => void handleChooseDirectory(key)}>Escolher pasta</button>{settingsDraft[key] && <button type="button" onClick={() => void window.lucao.app.openPath(settingsDraft[key]).catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Não foi possível abrir a pasta.'))}>Abrir</button>}</div>)}
        <p className="muted">Concorrência: 1 tarefa por vez. Pausa e concorrência paralela não são suportadas pelo motor nesta versão.</p>
      </section>
      <section className="panel settings-section"><div><h2>Interface e desempenho</h2><p className="muted">Tema roxo/neon fixo; não há telemetria de recursos ou aceleração GPU disponível nesta versão.</p></div></section>
      <div className="panel-actions"><button type="button" onClick={() => void handleResetSettings()}>Restaurar padrões</button><button type="button" className="primary" onClick={() => void handleSaveSettings()} disabled={isBusy}>{isBusy ? 'Salvando...' : 'Salvar configurações'}</button></div>
    </div>
  );

  const renderLogs = () => (
    <section className="panel queue-panel"><div className="panel-header"><div><h2>Logs e diagnóstico</h2><p className="muted">Logs locais · atualização automática a cada 5 segundos</p></div><div className="panel-actions"><button type="button" onClick={() => void refreshDiagnostics().catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Falha no diagnóstico.'))}>Executar diagnóstico</button><button type="button" onClick={() => void handleExportLogs()}>Exportar</button><button type="button" className="danger-quiet" onClick={() => void handleClearLogs()}>Limpar logs</button></div></div>
    <div className="diagnostics-grid">{diagnostics && <><DiagnosticRow label="FFmpeg" available={diagnostics.ffmpeg} detail={diagnostics.ffmpegPath} /><DiagnosticRow label="Whisper.cpp" available={diagnostics.whisper} detail={diagnostics.whisperPath} /><DiagnosticRow label={`Modelo ${settings?.defaultModel ?? ''}`} available={diagnostics.model.installed} detail={diagnostics.model.modelPath} /><DiagnosticRow label="Diretório de dados gravável" available={diagnostics.storageWritable} detail={diagnostics.dataDirectory} /></>}</div>
    <div className="panel-actions log-filters"><input aria-label="Pesquisar logs" placeholder="Pesquisar logs" value={logQuery} onChange={(event) => setLogQuery(event.target.value)} /><select aria-label="Filtrar nível de log" value={logFilter} onChange={(event) => setLogFilter(event.target.value as 'all' | AppLog['level'])}><option value="all">Todos os níveis</option><option value="info">Informação</option><option value="warn">Aviso</option><option value="error">Erro</option></select></div>
    {filteredLogs.length ? <ul className="log-list">{filteredLogs.map((log) => <li key={log.id} className={`log-entry ${log.level}`}><time>{formatDate(log.createdAt)}</time><strong>{log.level.toUpperCase()}</strong><span>{log.message}{log.details && <small>{log.details}</small>}</span><button type="button" onClick={() => void navigator.clipboard.writeText([log.message, log.details].filter(Boolean).join('\n')).then(() => setStatusMessage('Log copiado.'))}>Copiar</button></li>)}</ul> : <div className="empty-state">Não há logs para os filtros atuais.</div>}</section>
  );

  const pageContent: Record<NavKey, ReactNode> = {
    home: renderHome(),
    new: renderNew(),
    queue: renderQueue(),
    history: renderHistory(),
    models: renderModels(),
    settings: renderSettings(),
    logs: renderLogs(),
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">L</div><div className="brand-copy"><strong>LUCAO</strong><span>Audio Transcriber</span></div></div>
        <button type="button" className="sidebar-toggle" title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setSidebarCollapsed((current) => { localStorage.setItem('lucao-sidebar-collapsed', String(!current)); return !current; })}>{sidebarCollapsed ? '»' : '«'}</button>
        <nav className="nav">{navGroups.map((group) => <div className="nav-group" key={group.title}><span className="nav-group-title">{group.title}</span>{group.items.map((item) => <button key={item.key} type="button" title={sidebarCollapsed ? item.label : undefined} aria-label={item.label} className={`nav-item ${activeNav === item.key ? 'active' : ''}`} onClick={() => { setActiveNav(item.key); setStatusMessage(''); }}><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span></button>)}</div>)}</nav>
        <div className="sidebar-status"><span className={`engine-dot ${engineReady ? 'online' : 'offline'}`} /><div className="sidebar-status-copy"><span>Motor {engineReady ? 'pronto' : 'indisponível'}</span><strong>v{version}</strong></div></div>
      </aside>
      <main className="workspace">
        <header className="topbar"><div><p className="eyebrow">LUCAO / {activeNav}</p><h1>{title}</h1></div>{activeNav !== 'new' && <button type="button" className="primary" onClick={() => setActiveNav('new')}>＋ Nova transcrição</button>}</header>
        {statusMessage && <div className="status-banner" role="status">{statusMessage}<button type="button" aria-label="Fechar mensagem" onClick={() => setStatusMessage('')}>×</button></div>}
        <div className="page-enter" key={activeNav}>{pageContent[activeNav]}</div>
      </main>
      {selectedTranscript && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTranscript(null); }}><section className="panel transcript-modal" role="dialog" aria-modal="true" aria-labelledby="transcript-title"><div className="panel-header"><div><p className="eyebrow">TRANSCRIÇÃO</p><h2 id="transcript-title">{selectedTranscript.name}</h2></div><button type="button" aria-label="Fechar transcrição" onClick={() => setSelectedTranscript(null)}>×</button></div><p className="muted">{formatDate(selectedTranscript.updatedAt)} · {selectedTranscript.model}</p><div className="transcript-body">{selectedTranscript.transcript}</div><div className="panel-actions"><button type="button" onClick={() => void handleCopyTranscript(selectedTranscript)}>Copiar</button><button type="button" className="primary" onClick={() => void handleExportTranscript(selectedTranscript)}>Exportar TXT</button></div></section></div>}
    </div>
  );
}

function DiagnosticRow({ label, available, detail }: { label: string; available: boolean; detail?: string }) {
  return <div className="diagnostic-row"><span className={`engine-dot ${available ? 'online' : 'offline'}`} /><strong>{label}</strong><span>{available ? 'Disponível' : 'Não encontrado'}</span>{detail && <small title={detail}>{detail}</small>}</div>;
}
