import { useAuth } from '../hooks/useAuth';
import Chat from './Chat';

export default function TestAuth() {
  const { loading } = useAuth(); // Completely removed isAuthenticated to fix ESLint

  if (loading) {
    return <div style={{ padding: 40, color: 'white', fontFamily: 'sans-serif' }}>Loading session...</div>;
  }

  // Force show Chat immediately with no conditions
  return <Chat />;
}