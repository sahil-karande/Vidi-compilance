import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TestAuth from './pages/TestAuth';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/test-auth" replace />} />
        <Route path="/test-auth" element={<TestAuth />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;