import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/Home';
import { Admin } from './pages/Admin';
import { UnitSelection } from './pages/UnitSelection';
import { PracticeSession } from './pages/PracticeSession';
import { UnitExam } from './pages/UnitExam';
import { TutorMode } from './pages/TutorMode';
import { CaseMode } from './pages/CaseMode';
import { StudentDashboard } from './pages/StudentDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { FridayTests } from './pages/FridayTests';
import { ProtectedRoute } from './components/ProtectedRoute';

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
                        <Route path="/tutor/:unitId" element={<TutorMode />} />
                        <Route path="/case/:unitId" element={<CaseMode />} />
                        <Route path="/dashboard" element={<StudentDashboard />} />
                        <Route path="/friday" element={<FridayTests />} />
                    </Route>

                    {/* Protected Route for Admins */}
                    <Route element={<ProtectedRoute allowedRole="admin" />}>
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    </Route>

                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
