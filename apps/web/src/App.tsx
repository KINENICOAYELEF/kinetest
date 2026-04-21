import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/Home';
import { Admin } from './pages/Admin';
import { UnitSelection } from './pages/UnitSelection';
import { PracticeSession } from './pages/PracticeSession';
import { UnitExam } from './pages/UnitExam';
import { UnitFinalExam } from './pages/UnitFinalExam';
import { TutorMode } from './pages/TutorMode';
import { CaseMode } from './pages/CaseMode';
import { StudentDashboard } from './pages/StudentDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminContent } from './pages/AdminContent';
import { FridayTests } from './pages/FridayTests';
import { Debug } from './pages/Debug';
import { AdminUnits } from './pages/AdminUnits';
import { AdminSetup } from './pages/AdminSetup';
import { VoicePatientSimulator } from './pages/VoicePatientSimulator';
import { ClinicalReasoning } from './pages/ClinicalReasoning';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Pending } from './pages/Pending';
import { TestGemini } from './pages/TestGemini';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    
                    {/* Standalone Route para Estudiantes (Sin Auth obligatorio) */}
                    <Route path="/simulador" element={<VoicePatientSimulator />} />
                    <Route path="/auditoria" element={<ClinicalReasoning standaloneMode={3} />} />

                    {/* Protected Route for Students */}
                    <Route element={<ProtectedRoute allowedRole="student" />}>
                        <Route path="/home" element={<Home />} />
                        <Route path="/units" element={<UnitSelection />} />
                        <Route path="/units/:unitId/voice-practice" element={<VoicePatientSimulator />} />
                        <Route path="/units/:unitId/tutor" element={<TutorMode />} />
                        <Route path="/units/:unitId/exam" element={<UnitExam />} />
                        <Route path="/practice/:unitId" element={<PracticeSession />} />
                        <Route path="/exam/:unitId" element={<UnitExam />} />
                        <Route path="/final-exam/:unitId" element={<UnitFinalExam />} />
                        <Route path="/tutor/:unitId" element={<TutorMode />} />
                        <Route path="/case/:unitId" element={<CaseMode />} />
                        <Route path="/dashboard" element={<StudentDashboard />} />
                        <Route path="/friday" element={<FridayTests />} />
                        <Route path="/clinical-reasoning" element={<ClinicalReasoning />} />
                    </Route>

                    <Route element={<ProtectedRoute allowedRole="admin" />}>
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                        <Route path="/admin/content" element={<AdminContent />} />
                        <Route path="/admin/units" element={<AdminUnits />} />
                        <Route path="/debug" element={<Debug />} />
                        <Route path="/admin/setup" element={<AdminSetup />} />
                        <Route path="/admin/test-ai" element={<TestGemini />} />
                    </Route>

                    {/* Pending state route */}
                    <Route path="/pending" element={<Pending />} />

                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
