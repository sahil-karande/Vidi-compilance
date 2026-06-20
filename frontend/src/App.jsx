import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TestAuth from './pages/TestAuth';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect base URL to test page */}
        <Route path="/" element={<Navigate to="/test-auth" replace />} />
        
        {/* Test Auth page routes */}
        <Route path="/test-auth" element={<TestAuth />} />
        
        {/* Handle the Supabase redirect target */}
        <Route path="/dashboard" element={<TestAuth />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;