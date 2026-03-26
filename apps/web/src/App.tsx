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
import { ProtectedRoute } from './components/ProtectedRoute';
import { Pending } from './pages/Pending';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    {/* Protected Route for Students */}
                    <Route element={<ProtectedRoute allowedRole="student" />}>
                        <Route path="/home" element={<Home />} />
                        <Route path="/units" element={<UnitSelection />} />
                        <Route path="/practice/:unitId" element={<PracticeSession />} />
                        <Route path="/exam/:unitId" element={<UnitExam />} />
                        <Route path="/final-exam/:unitId" element={<UnitFinalExam />} />
                        <Route path="/tutor/:unitId" element={<TutorMode />} />
                        <Route path="/case/:unitId" element={<CaseMode />} />
                        <Route path="/dashboard" element={<StudentDashboard />} />
                        <Route path="/friday" element={<FridayTests />} />
                    </Route>

                    <Route element={<ProtectedRoute allowedRole="admin" />}>
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                        <Route path="/admin/content" element={<AdminContent />} />
                        <Route path="/admin/units" element={<AdminUnits />} />
                        <Route path="/debug" element={<Debug />} />
                        <Route path="/admin/setup" element={<AdminSetup />} />
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
