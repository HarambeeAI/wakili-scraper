import { useHandleSignInCallback } from '@logto/react';
import { useNavigate } from 'react-router-dom';

const Callback = () => {
  const navigate = useNavigate();
  const { isLoading } = useHandleSignInCallback(() => {
    navigate('/dashboard');
  });
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p>Signing in...</p></div>;
  return null;
};

export default Callback;
