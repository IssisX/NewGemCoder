import React, { useState, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { LucideShield, LucideTerminal, LucideFileCode, LucideFlaskConical, LucideBrainCircuit, LucidePlay, LucideLoader, LucideCheckCircle, LucideAlertTriangle, LucideBot, LucideUser, LucideFileText, LucideSparkles, LucideSave, LucideFolder, LucideTrash2, LucideWrench, LucideMessageCircle, LucideSend } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { setLogLevel } from 'firebase/firestore';

// --- ZUSTAND STATE MANAGEMENT STORE (v2.1) ---
// No structural changes needed, as model is abstracted.
const useGenieStore = create((set, get) => ({
    // Core State
    status: 'AWAITING_KEY',
    logs: [],
    currentTask: 'Idle',
    
    // User & Project Inputs
    apiKey: '',
    prompt: '',
    userId: null,
    projects: [],
    currentProjectId: null,

    // Layered Intelligence State
    refinement: { isActive: false, questions: [], answers: [] },
    correction: { iteration: 0, maxIterations: 3 },

    // Generated Artifacts
    plan: null,
    generatedCode: '',
    testResults: null,
    reflections: null,

    // Firebase instances
    db: null,
    auth: null,
    isAuthReady: false,

    // --- ACTIONS ---
    
    // Initialization & Auth
    initializeFirebase: (db, auth) => set({ db, auth }),
    setAuthReady: (isAuthReady, userId) => set({ 
        isAuthReady, 
        userId, 
        status: userId ? (get().apiKey ? 'IDLE' : 'AWAITING_KEY') : 'AWAITING_AUTH' 
    }),

    // API Key Management
    setApiKey: (apiKey) => {
        set({ apiKey });
        if (apiKey && get().status === 'AWAITING_KEY' && get().isAuthReady) {
            set({ status: 'IDLE', currentTask: 'Ready. Provide a new project goal.' });
        } else if (!apiKey) {
            set({ status: 'AWAITING_KEY', currentTask: 'Awaiting API Key.' });
        }
    },
    
    // Project Management
    loadProjects: (projects) => set({ projects }),
    setCurrentProject: (projectId) => {
        const project = get().projects.find(p => p.id === projectId);
        if (project) {
            set({
                currentProjectId: projectId,
                prompt: project.prompt,
                plan: project.plan,
                generatedCode: project.generatedCode,
                testResults: project.testResults,
                reflections: project.reflections,
                logs: project.logs || [],
                refinement: { isActive: false, questions: [], answers: [] }, // Reset on load
                status: project.status || 'IDLE',
                currentTask: 'Project loaded. Ready for instructions.'
            });
        }
    },
    clearCurrentProject: () => set({
        currentProjectId: null,
        prompt: '',
        plan: null,
        generatedCode: '',
        testResults: null,
        reflections: null,
        logs: [],
        refinement: { isActive: false, questions: [], answers: [] },
        status: 'IDLE',
        currentTask: 'Ready. Provide a new project goal.'
    }),

    // Core Agent Logic (v2)
    startProject: async (prompt) => {
        if (!prompt || !get().apiKey) {
            get().addLog('Error: Prompt and API Key are required to start.', 'error');
            return;
        }

        const newProjectId = `proj_${Date.now()}`;
        set({
            prompt,
            currentProjectId: newProjectId,
            status: 'REFINING', // <-- New starting phase
            currentTask: 'Analyzing prompt for ambiguities...',
            logs: [],
            plan: null,
            generatedCode: '',
            testResults: null,
            reflections: null,
            refinement: { isActive: false, questions: [], answers: [] },
            correction: { iteration: 0, maxIterations: 3 },
        });

        get().addLog(`New project started. ID: ${newProjectId}`, 'system');
        get().addLog(`Initial Goal: ${prompt}`, 'user');

        const { db, userId } = get();
        if (db && userId) {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, newProjectId);
            try {
                await setDoc(projectRef, {
                    id: newProjectId,
                    prompt: prompt,
                    createdAt: new Date().toISOString(),
                    status: 'REFINING',
                    logs: get().logs,
                });
            } catch (error) {
                console.error("Firestore Error:", error);
                get().addLog(`Firestore Error: Failed to create project. ${error.message}`, 'error');
                set({ status: 'ERROR', currentTask: 'Error saving project.' });
            }
        }
    },

    // State Mutators & Updaters
    addLog: (message, type = 'agent') => {
      const newLog = { message, type, timestamp: new Date().toISOString() };
      set(state => ({ logs: [...state.logs, newLog] }));
      get().updateFirestoreLog();
    },
    updateFirestoreLog: () => {
        const { db, userId, currentProjectId, logs } = get();
        if (db && userId && currentProjectId) {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, currentProjectId);
            updateDoc(projectRef, { logs }).catch(err => console.error("Failed to update logs in Firestore:", err));
        }
    },
    
    // Layered Intelligence Actions
    setRefinementQuestions: (questions) => {
        if (questions && questions.length > 0) {
            set({ refinement: { isActive: true, questions: questions, answers: [] }, currentTask: 'Awaiting user input for clarification.' });
            get().addLog(`Prompt requires clarification. Asking ${questions.length} questions.`, 'system');
        } else {
            // Prompt is clear, move to planning
            set({ refinement: { isActive: false, questions: [], answers: [] }, status: 'PLANNING', currentTask: 'Architecting Solution...' });
            get().addLog('Prompt is clear. Proceeding to architectural planning.', 'success');
        }
    },
    submitRefinementAnswer: (answer) => {
        set(state => {
            const newAnswers = [...state.refinement.answers, answer];
            const isDone = newAnswers.length === state.refinement.questions.length;
            if (isDone) {
                get().addLog('All clarifications received. Proceeding to planning.', 'user');
                return {
                    refinement: { ...state.refinement, answers: newAnswers, isActive: false },
                    status: 'PLANNING',
                    currentTask: 'Architecting Solution...'
                };
            }
            return {
                refinement: { ...state.refinement, answers: newAnswers }
            };
        });
    },

    setPlan: (plan) => set(state => {
      get().addLog('Architectural plan generated.', 'success');
      return { plan, status: 'CODING', currentTask: 'Generating Code...' };
    }),
    appendCode: (chunk) => set(state => {
      get().addLog(`Code block received. Appending to workspace.`, 'agent');
      return { generatedCode: state.generatedCode + chunk };
    }),
    completeCoding: () => set(state => {
      get().addLog('Initial code generation complete.', 'success');
      return { status: 'TESTING', currentTask: 'Auditing & Testing Code...' };
    }),
    setTestResults: (results) => set(state => {
      get().addLog('Testing and audit phase complete.', 'success');
      if (results.issues && results.issues.length > 0) {
          get().addLog(`Found ${results.issues.length} issues. Entering self-correction loop.`, 'system');
          return { testResults: results, status: 'CORRECTING', currentTask: `Correcting code (Attempt ${state.correction.iteration + 1})` };
      }
      get().addLog('No issues found. Code passed audit.', 'success');
      return { testResults: results, status: 'REFACTORING', currentTask: 'Refactoring & Improving...' };
    }),
    setCodeAndIterate: (newCode) => set(state => {
        get().addLog(`Applying corrections. Re-running tests.`, 'agent');
        return {
            generatedCode: newCode,
            status: 'TESTING',
            currentTask: `Re-testing code after corrections (Attempt ${state.correction.iteration + 1})`,
            correction: { ...state.correction, iteration: state.correction.iteration + 1 }
        };
    }),
    setReflections: (reflections) => set(state => {
      get().addLog('Self-reflection complete.', 'success');
      return { reflections, status: 'COMPLETED', currentTask: 'Project Complete.' };
    }),
    updateStatus: (status, currentTask) => set({ status, currentTask }),
}));


// --- REACT COMPONENTS (v2.1) ---

const App = () => {
    const { status, initializeFirebase, setAuthReady, isAuthReady, addLog, currentProjectId } = useGenieStore();
    const orchestratorRunning = useRef(false);

    // 1. Initialize Firebase and Authentication
    useEffect(() => {
        try {
            const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
            if (!firebaseConfig.apiKey) {
                console.error("Firebase config not found.");
                useGenieStore.setState({ status: 'ERROR', currentTask: 'Firebase configuration is missing.' });
                return;
            }
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);
            initializeFirebase(db, auth);

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setAuthReady(true, user.uid);
                } else {
                    try {
                        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                            await signInWithCustomToken(auth, __initial_auth_token);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (error) {
                        console.error("Auth Error:", error);
                        addLog(`Authentication failed: ${error.message}`, 'error');
                        setAuthReady(false, null);
                    }
                }
            });
        } catch (error) {
            console.error("Firebase Initialization Error:", error);
            useGenieStore.setState({ status: 'ERROR', currentTask: `Firebase Init Failed: ${error.message}` });
        }
    }, [initializeFirebase, setAuthReady, addLog]);

    // 2. Project List Loader
     useEffect(() => {
      const { db, userId } = useGenieStore.getState();
      if (isAuthReady && db && userId) {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          const projectsColRef = collection(db, `artifacts/${appId}/users/${userId}/projects`);
          const unsubscribe = onSnapshot(projectsColRef, (snapshot) => {
               const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
               useGenieStore.getState().loadProjects(projects);
          }, err => {
              console.error("Error loading projects:", err);
              addLog(`Failed to load projects: ${err.message}`, 'error');
          });
          return () => unsubscribe();
      }
    }, [isAuthReady, addLog]);
    
    // 3. The Agent Orchestrator
    useEffect(() => {
        const state = useGenieStore.getState();
        if (!state.isAuthReady || !state.currentProjectId || state.refinement.isActive) return;

        const runAgentLifecycle = async () => {
            if (orchestratorRunning.current) return;
            orchestratorRunning.current = true;

            const currentState = useGenieStore.getState(); // Get fresh state
            try {
                switch (currentState.status) {
                    case 'REFINING':
                        await runRefinementPhase(currentState);
                        break;
                    case 'PLANNING':
                        await runPlanningPhase(currentState);
                        break;
                    case 'CODING':
                        await runCodingPhase(currentState);
                        break;
                    case 'TESTING':
                        await runTestingPhase(currentState);
                        break;
                    case 'CORRECTING':
                        await runCorrectionPhase(currentState);
                        break;
                    case 'REFACTORING':
                        await runReflectionPhase(currentState);
                        break;
                }
            } catch (error) {
                console.error("Agent Lifecycle Error:", error);
                useGenieStore.getState().updateStatus('ERROR', `An error occurred: ${error.message}`);
            } finally {
                orchestratorRunning.current = false;
            }
        };

        const activeStates = ['REFINING', 'PLANNING', 'CODING', 'TESTING', 'CORRECTING', 'REFACTORING'];
        if (activeStates.includes(state.status)) {
            runAgentLifecycle();
        }
    }, [status, isAuthReady, currentProjectId]);


    return (
        <div className="bg-gray-900 text-gray-200 font-sans h-screen flex flex-col">
            <Header />
            <main className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden relative">
                <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto">
                   <ControlPanel />
                   <ProjectManager />
                </div>
                <div className="lg:col-span-5 flex flex-col bg-gray-800/50 rounded-lg shadow-inner overflow-hidden">
                    <Workspace />
                </div>
                <div className="lg:col-span-4 flex flex-col bg-gray-800/50 rounded-lg shadow-inner overflow-hidden">
                    <PreviewPanel />
                </div>
                <RefinementModal />
            </main>
            <StatusBar />
        </div>
    );
};

// --- Child Components ---

const Header = () => (
    <header className="flex items-center justify-between p-3 border-b border-purple-400/20 bg-gray-900 shadow-lg">
        <div className="flex items-center gap-3">
            <LucideBrainCircuit className="text-purple-400 w-8 h-8" />
            <div>
                <h1 className="text-xl font-bold text-white">Genie v2.1</h1>
                <p className="text-xs text-gray-400">Powered by Gemini 2.5 Flash</p>
            </div>
        </div>
        <div className="text-xs text-gray-500">v2.1.0</div>
    </header>
);

const ControlPanel = () => {
    const { apiKey, setApiKey, prompt, status, startProject, clearCurrentProject } = useGenieStore();
    const [localPrompt, setLocalPrompt] = useState(prompt);

    useEffect(() => { setLocalPrompt(prompt); }, [prompt]);

    const handleStart = () => {
        if (localPrompt && apiKey) {
            startProject(localPrompt);
        }
    };
    
    const isRunning = !['IDLE', 'COMPLETED', 'ERROR', 'AWAITING_KEY', 'AWAITING_AUTH'].includes(status);

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col gap-4 shadow-lg">
            <h2 className="font-bold text-lg flex items-center gap-2"><LucideShield className="text-green-400"/>Control & Configuration</h2>
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-400">Gemini API Key</label>
                <input type="password" placeholder="Enter your API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none transition" />
            </div>
            <div className="flex flex-col gap-1 flex-grow">
                <label className="text-sm font-medium text-gray-400">Project Goal</label>
                <textarea placeholder="Describe the application you want to build..." value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-md p-2 text-sm flex-grow resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                    rows={5} disabled={isRunning} />
            </div>
            <div className="flex gap-2">
                <button onClick={handleStart} disabled={!apiKey || !localPrompt || isRunning}
                    className="flex-grow bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg">
                    {isRunning ? <LucideLoader className="animate-spin" /> : <LucidePlay />}
                    {isRunning ? "Working..." : "Start New Project"}
                </button>
                 <button onClick={clearCurrentProject} disabled={isRunning}
                    className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white font-bold p-2 rounded-md transition-all duration-200" title="Clear and start new">
                   <LucideFileText />
                </button>
            </div>
        </div>
    );
};

const ProjectManager = () => {
    const { projects, setCurrentProject, currentProjectId, userId, db } = useGenieStore();
    
    const deleteProject = async (projectId) => {
        if (db && userId) {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, projectId);
            try {
                await deleteDoc(projectRef);
                useGenieStore.getState().clearCurrentProject();
            } catch (error) {
                console.error("Error deleting project:", error);
            }
        }
    };

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col gap-2 shadow-lg flex-grow overflow-y-auto">
            <h2 className="font-bold text-lg flex items-center gap-2"><LucideFolder className="text-yellow-400"/>Saved Projects</h2>
            <div className="space-y-2 overflow-y-auto">
                {projects.length === 0 ? (
                    <p className="text-sm text-gray-500">No saved projects found.</p>
                ) : (
                    projects.map(p => (
                        <div key={p.id} className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${currentProjectId === p.id ? 'bg-purple-600/30' : 'bg-gray-700/50 hover:bg-gray-600/50'}`}>
                            <div onClick={() => setCurrentProject(p.id)} className="flex-grow">
                                <p className="font-semibold truncate text-sm">{p.prompt}</p>
                                <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleString()}</p>
                            </div>
                            <button onClick={() => deleteProject(p.id)} className="text-red-500 hover:text-red-400 p-1 ml-2">
                                <LucideTrash2 size={16}/>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const RefinementModal = () => {
    const { refinement, submitRefinementAnswer } = useGenieStore();
    const [currentAnswer, setCurrentAnswer] = useState('');

    if (!refinement.isActive) return null;

    const currentQuestionIndex = refinement.answers.length;
    const currentQuestion = refinement.questions[currentQuestionIndex];

    const handleSubmit = () => {
        if (currentAnswer.trim()) {
            submitRefinementAnswer(currentAnswer);
            setCurrentAnswer('');
        }
    };

    return (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg flex flex-col gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><LucideMessageCircle className="text-purple-400" />Clarification Needed</h2>
                <div className="bg-gray-900 p-4 rounded-md">
                    <p className="font-medium">{currentQuestion}</p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="Your answer..."
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                    />
                    <button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-500 text-white font-bold p-2 rounded-md flex items-center justify-center gap-2 transition-colors">
                        <LucideSend size={16} />
                    </button>
                </div>
                <p className="text-xs text-gray-500 text-center">Question {currentQuestionIndex + 1} of {refinement.questions.length}</p>
            </div>
        </div>
    );
};

const Workspace = () => {
    const [activeTab, setActiveTab] = useState('logs');
    const tabs = [
        { id: 'logs', label: 'Agent Logs', icon: LucideTerminal },
        { id: 'plan', label: 'Execution Plan', icon: LucideFileText },
        { id: 'code', label: 'Generated Code', icon: LucideFileCode },
        { id: 'tests', label: 'Test & Audit', icon: LucideFlaskConical },
        { id: 'reflections', label: 'Reflections', icon: LucideSparkles },
    ];
    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b border-purple-400/20 px-2">
                <nav className="-mb-px flex space-x-2" aria-label="Tabs">{tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`${activeTab === tab.id ? 'border-purple-400 text-purple-300' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}>
                        <tab.icon size={16} /> {tab.label}
                    </button>))}
                </nav>
            </div>
            <div className="flex-grow overflow-y-auto p-4">
                {activeTab === 'logs' && <LogsPanel />}
                {activeTab === 'plan' && <PlanPanel />}
                {activeTab === 'code' && <CodePanel />}
                {activeTab === 'tests' && <TestPanel />}
                {activeTab === 'reflections' && <ReflectionsPanel />}
            </div>
        </div>
    );
};
const LogIcon = ({ type }) => {
    switch (type) {
        case 'user': return <LucideUser className="text-blue-400 flex-shrink-0" size={16} />;
        case 'agent': return <LucideBot className="text-gray-400 flex-shrink-0" size={16} />;
        case 'system': return <LucideShield className="text-purple-400 flex-shrink-0" size={16} />;
        case 'tool': return <LucideWrench className="text-yellow-400 flex-shrink-0" size={16} />;
        case 'success': return <LucideCheckCircle className="text-green-400 flex-shrink-0" size={16} />;
        case 'error': return <LucideAlertTriangle className="text-red-400 flex-shrink-0" size={16} />;
        default: return <LucideBot className="text-gray-400 flex-shrink-0" size={16} />;
    }
};
const LogsPanel = () => {
    const logs = useGenieStore((state) => state.logs);
    const scrollRef = useRef(null);
    useEffect(() => { if (scrollRef.current) { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; } }, [logs]);
    return ( <div ref={scrollRef} className="h-full overflow-y-auto"> <div className="space-y-3 font-mono text-sm"> {logs.map((log, index) => ( <div key={index} className="flex items-start gap-3"> <LogIcon type={log.type} /> <div className="flex-grow"> <p className="whitespace-pre-wrap">{log.message}</p> <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</p> </div> </div> ))} </div> </div> );
};
const PlanPanel = () => {
    const plan = useGenieStore((state) => state.plan);
    if (!plan) return <div className="text-center text-gray-500">Awaiting execution plan...</div>;
    return (
        <div className="prose prose-invert prose-sm">
            <h3>Architectural Plan</h3> <p>{plan.summary}</p>
            <h4>Execution Steps:</h4>
            <ol className="list-decimal pl-5 space-y-2">
                {plan.steps.map((step, index) => <li key={index} className="flex items-start gap-2">
                    <span>{step.description}</span>
                    {step.tool && <span className="inline-flex items-center gap-1 bg-yellow-400/20 text-yellow-300 text-xs font-medium px-2 py-0.5 rounded-full"><LucideWrench size={12}/>{step.tool}</span>}
                </li>)}
            </ol>
        </div>
    );
};
const CodePanel = () => {
    const code = useGenieStore((state) => state.generatedCode);
    if (!code) return <div className="text-center text-gray-500">Awaiting code generation...</div>;
    return <pre className="text-xs whitespace-pre-wrap bg-gray-900 p-4 rounded-md">{code}</pre>;
};
const TestPanel = () => {
    const results = useGenieStore((state) => state.testResults);
    if (!results) return <div className="text-center text-gray-500">Awaiting testing & auditing...</div>;
    return ( <div className="prose prose-invert prose-sm"> <h3>Code Audit & Testing Results</h3> <p>{results.summary}</p> {results.issues && results.issues.length > 0 ? ( <><h4>Identified Issues:</h4> <ul> {results.issues.map((issue, index) => <li key={index}>{issue}</li>)} </ul></> ) : (<p className="text-green-400">No issues identified.</p>)} </div> );
};
const ReflectionsPanel = () => {
    const reflections = useGenieStore((state) => state.reflections);
    if (!reflections) return <div className="text-center text-gray-500">Awaiting self-reflection...</div>;
     return ( <div className="prose prose-invert prose-sm"> <h3>Post-Mortem & Reflections</h3> <p><strong>Overall Assessment:</strong> {reflections.assessment}</p> <h4>Potential Improvements:</h4> <ul> {reflections.improvements.map((item, index) => <li key={index}>{item}</li>)} </ul> <h4>Key Learnings:</h4> <ul> {reflections.learnings.map((item, index) => <li key={index}>{item}</li>)} </ul> </div> );
};
const PreviewPanel = () => {
    const code = useGenieStore((state) => state.generatedCode);
    const [previewContent, setPreviewContent] = useState('');
    useEffect(() => { const handler = setTimeout(() => { const htmlWithTailwind = ` <!DOCTYPE html> <html> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <script src="https://cdn.tailwindcss.com"></script> </head> <body> ${code} </body> </html> `; setPreviewContent(htmlWithTailwind); }, 500); return () => clearTimeout(handler); }, [code]);
    return ( <div className="w-full h-full flex flex-col"> <h2 className="text-lg font-bold p-3 border-b border-purple-400/20 flex-shrink-0">Live Preview</h2> <div className="flex-grow bg-white"> <iframe srcDoc={previewContent} title="Live Preview" className="w-full h-full border-none" sandbox="allow-scripts allow-modals allow-forms" /> </div> </div> );
};
const StatusBar = () => {
    const { status, currentTask, userId } = useGenieStore();
    const getStatusIndicator = () => {
        switch (status) {
            case 'AWAITING_KEY': case 'AWAITING_AUTH': case 'ERROR': return <LucideAlertTriangle className="text-red-400" />;
            case 'IDLE': return <LucideBot className="text-gray-400" />;
            case 'COMPLETED': return <LucideCheckCircle className="text-green-400" />;
            case 'REFINING': return <LucideMessageCircle className="text-purple-400" />;
            default: return <LucideLoader className="animate-spin text-purple-400" />;
        }
    };
    return ( <footer className="flex items-center justify-between p-2 border-t border-purple-400/20 text-xs bg-gray-900"> <div className="flex items-center gap-2"> {getStatusIndicator()} <span>{currentTask}</span> </div> {userId && <div className="font-mono text-gray-500">UserID: {userId}</div>} </footer> );
};

// --- AGENT LIFECYCLE & LLM LOGIC (v2.1) ---

const callGeminiAPI = async (promptText, apiKey, isJson = false) => {
    const { addLog } = useGenieStore.getState();
    addLog(`Sending request to Gemini API...`, 'system');
    try {
        const payload = { contents: [{ role: "user", parts: [{ text: promptText }] }] };
        // --- MODEL UPGRADE ---
        // Swapped gemini-2.0-flash with gemini-2.5-flash
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            addLog(`Received response from Gemini API.`, 'system');
            let text = result.candidates[0].content.parts[0].text;
            if (isJson) {
                text = text.replace(/```(json)?/g, '').trim();
            }
            return text;
        } else {
            console.error("Invalid API response structure:", result);
            throw new Error('Invalid or empty response from Gemini API.');
        }
    } catch (error) {
        console.error("Gemini API call failed:", error);
        addLog(`Error interacting with Gemini: ${error.message}`, 'error');
        useGenieStore.getState().updateStatus('ERROR', 'API communication failed.');
        return null;
    }
};

const runRefinementPhase = async (state) => {
    const { addLog, setRefinementQuestions, apiKey, prompt } = state;
    addLog('Entering refinement phase. Analyzing prompt clarity.', 'agent');

    const refinementPrompt = `You are a requirements analyst. Your job is to determine if a user's request is clear enough to act on, or if it requires clarification. Analyze the following request. Respond with a JSON object with two keys: "is_clear" (a boolean) and "questions" (an array of strings). If the request is perfectly clear, set "is_clear" to true and "questions" to an empty array. If it is ambiguous (e.g., "make a dashboard" without specifying what data to show), set "is_clear" to false and provide specific, targeted questions to clarify the user's intent.

User Request: "${prompt}"

Generate the JSON analysis.`;
    
    const jsonString = await callGeminiAPI(refinementPrompt, apiKey, true);
    if (jsonString) {
        try {
            const analysis = JSON.parse(jsonString);
            if (analysis.is_clear) {
                setRefinementQuestions([]);
            } else {
                setRefinementQuestions(analysis.questions || []);
            }
        } catch (e) {
            addLog(`Failed to parse refinement analysis: ${e.message}. Assuming prompt is clear.`, 'error');
            setRefinementQuestions([]);
        }
    } else {
        addLog('Could not get refinement analysis. Proceeding with original prompt.', 'system');
        setRefinementQuestions([]);
    }
};

const runPlanningPhase = async (state) => {
    const { addLog, setPlan, apiKey, prompt, refinement, db, userId, currentProjectId } = state;
    addLog('Entering planning phase.', 'agent');

    let fullPrompt = `Original Goal: ${prompt}`;
    if (refinement.answers.length > 0) {
        fullPrompt += "\n\nUser Clarifications:\n";
        refinement.questions.forEach((q, i) => {
            fullPrompt += `- Q: ${q}\n  A: ${refinement.answers[i]}\n`;
        });
    }

    const planningPrompt = `You are a world-class software architect. Your task is to create a technical plan for a user's goal. The output must be a JSON object with "summary" and "steps" keys. Each step in the "steps" array must be an object with a "description" and a "tool". Available tools are:
- "standard-component": For general purpose HTML elements (divs, text, headers).
- "interactive-form": For creating a form with fields, labels, and a submit button. Use this if the user asks for any kind of data input.

Based on the full context below, generate the JSON plan.

Full Context:
${fullPrompt}`;

    const planJsonString = await callGeminiAPI(planningPrompt, apiKey, true);
    if (planJsonString) {
        try {
            const parsedPlan = JSON.parse(planJsonString);
            setPlan(parsedPlan);
            if (db && userId && currentProjectId) {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, currentProjectId);
                await updateDoc(projectRef, { plan: parsedPlan, status: 'CODING' });
            }
        } catch (e) {
            addLog(`Failed to parse architectural plan: ${e.message}`, 'error');
            useGenieStore.getState().updateStatus('ERROR', 'Failed to understand plan.');
        }
    }
};

const runCodingPhase = async (state) => {
    const { addLog, appendCode, completeCoding, apiKey, plan, db, userId, currentProjectId } = state;
    if (!plan?.steps) { return; }

    addLog(`Entering coding phase. Executing ${plan.steps.length} steps.`, 'agent');
    let fullCode = '';
    for (const step of plan.steps) {
        addLog(`Executing step: "${step.description}"`, 'agent');
        addLog(`Selected tool: [${step.tool}]`, 'tool');

        let codingPrompt;
        if (step.tool === 'interactive-form') {
            codingPrompt = `You are an expert form developer. Create a complete, accessible HTML form based on the instruction. Use TailwindCSS. The form should have a container, labels for each input, appropriate input types, and a styled submit button.
Instruction: "${step.description}"
Generate only the HTML for the form block.`;
        } else {
            codingPrompt = `You are an expert front-end developer. Based on the following instruction, write a block of HTML code for the body. Use Tailwind CSS classes for all styling. Do not include \`<html>\`, \`<head>\`, or \`<body>\` tags.
Instruction: "${step.description}"
Generate the HTML block.`;
        }
        
        const codeChunk = await callGeminiAPI(codingPrompt, apiKey);
        if (codeChunk) {
            appendCode(codeChunk.replace(/```(html)?/g, '').trim() + '\n\n');
            fullCode += codeChunk.replace(/```(html)?/g, '').trim() + '\n\n';
        } else { return; }
    }
    
    completeCoding();
    if (db && userId && currentProjectId) {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, currentProjectId);
        await updateDoc(projectRef, { generatedCode: fullCode, status: 'TESTING' });
    }
};

const runTestingPhase = async (state) => { 
    const { addLog, setTestResults, apiKey, generatedCode, db, userId, currentProjectId } = state;
    addLog('Entering testing and auditing phase.', 'agent');
    
    const testingPrompt = `You are a meticulous QA engineer. Review the following HTML code. Identify potential bugs, accessibility issues, or deviations from best practices. Provide findings as a JSON object with "summary" and "issues" keys. If no issues are found, the "issues" array MUST be empty.
Code:
\`\`\`html
${generatedCode}
\`\`\`
Generate the JSON audit.`;

    const testJsonString = await callGeminiAPI(testingPrompt, apiKey, true);
    if (testJsonString) {
        try {
            const parsedResults = JSON.parse(testJsonString);
            setTestResults(parsedResults);
            if (db && userId && currentProjectId) {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, currentProjectId);
                const nextStatus = (parsedResults.issues && parsedResults.issues.length > 0) ? 'CORRECTING' : 'REFACTORING';
                await updateDoc(projectRef, { testResults: parsedResults, status: nextStatus });
            }
        } catch (e) {
             addLog(`Failed to parse testing results: ${e.message}`, 'error');
             useGenieStore.getState().updateStatus('ERROR', 'Failed to understand test results.');
        }
    }
};

const runCorrectionPhase = async (state) => {
    const { addLog, setCodeAndIterate, apiKey, generatedCode, testResults, correction, db, userId, currentProjectId } = state;
    if (correction.iteration >= correction.maxIterations) {
        addLog(`Max correction attempts reached. Proceeding with known issues.`, 'error');
        useGenieStore.getState().updateStatus('REFACTORING', 'Refactoring & Improving...');
        return;
    }
    
    addLog(`Entering correction phase (Attempt ${correction.iteration + 1})`, 'agent');
    
    const correctionPrompt = `You are a senior developer tasked with fixing buggy code. Below is the original code and a list of issues from a QA audit. Your task is to rewrite the entire code block, fixing all the identified issues.
    
Original Code:
\`\`\`html
${generatedCode}
\`\`\`

Issues to Fix:
- ${testResults.issues.join('\n- ')}

Generate the complete, corrected HTML code block. Do not include explanations, just the code.`;

    const correctedCode = await callGeminiAPI(correctionPrompt, apiKey);
    if (correctedCode) {
        setCodeAndIterate(correctedCode.replace(/```(html)?/g, '').trim());
        if (db && userId && currentProjectId) {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, currentProjectId);
            await updateDoc(projectRef, { generatedCode: correctedCode, status: 'TESTING' });
        }
    } else {
        addLog('Failed to generate corrections. Halting.', 'error');
        useGenieStore.getState().updateStatus('ERROR', 'Code correction failed.');
    }
};


const runReflectionPhase = async (state) => { 
    const { addLog, setReflections, apiKey, prompt, generatedCode, testResults, db, userId, currentProjectId } = state;
    addLog('Entering self-reflection phase.', 'agent');
    
    const reflectionPrompt = `You are a Staff Software Engineer conducting a post-mortem. Based on the initial goal, the final code, and the QA audit, provide a brief reflection as a JSON object with "assessment", "improvements", and "learnings" keys.
Initial Goal: "${prompt}"
Final Code: \`\`\`html\n${generatedCode}\n\`\`\`
QA Audit: ${JSON.stringify(testResults)}
Generate the JSON reflection.`;

    const reflectionJsonString = await callGeminiAPI(reflectionPrompt, apiKey, true);
    if (reflectionJsonString) {
        try {
            const parsedReflections = JSON.parse(reflectionJsonString);
            setReflections(parsedReflections);
            if (db && userId && currentProjectId) {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, currentProjectId);
                await updateDoc(projectRef, { reflections: parsedReflections, status: 'COMPLETED' });
            }
        } catch (e) {
            addLog(`Failed to parse reflections: ${e.message}`, 'error');
            useGenieStore.getState().updateStatus('ERROR', 'Failed to understand reflections.');
        }
    }
};

export default App;
