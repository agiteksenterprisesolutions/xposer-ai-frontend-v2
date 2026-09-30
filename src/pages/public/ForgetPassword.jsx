// src/pages/public/ForgetPassword.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Shield,
  Mail,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { authAPI } from '../../api/auth';
import { toast } from 'react-toastify';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetSchema = z.object({
  reset_code: z.string().min(4, 'Reset code is required'),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

const ForgetPassword = () => {
  useSEO({
    title: 'Reset Password',
    description: 'Reset the password for your Xposer AI account.',
    noIndex: true,
  });
  const { user } = useAuthStore();

  const [step, setStep] = useState('request'); // request | reset
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
  } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      reset_code: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const handleRequestReset = async (data) => {
    setIsLoading(true);
    setError('');

    try {
      await authAPI.forgotPassword(data.email);
      setEmail(data.email);
      setStep('reset');
      toast.success('Password reset instructions sent to your email.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset instructions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data) => {
    setIsLoading(true);
    setError('');

    try {
      await authAPI.resetPassword({
        email,
        token: data.reset_code,
        new_password: data.new_password,
      });
      toast.success('Password reset successfully! Please log in.');
      navigate(`/${user ? user.organization_slug : ''}/login`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await authAPI.forgotPassword(email);
      toast.success('Reset instructions resent.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend reset instructions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Reset Your Password</h1>
          <p className="text-gray-600 mt-2">
            {step === 'request'
              ? 'Enter your email to receive a reset code.'
              : 'Enter the reset code and choose a new password.'}
          </p>
        </div>

        <Card className="shadow-xl">
          {error && (
            <Alert variant="error" className="mb-6">
              <div className="flex items-center">
                {error}
              </div>
            </Alert>
          )}

          {step === 'request' ? (
            <form onSubmit={handleEmailSubmit(handleRequestReset)} className="space-y-6">
              <Input
                label="Email Address"
                type="email"
                startAdornment={<Mail className="w-4 h-4" />}
                {...registerEmail('email')}
                error={emailErrors.email?.message}
                autoFocus
                required
              />

              <Button
                type="submit"
                isLoading={isLoading}
                disabled={isLoading}
                className="w-full"
                variant="secondary"
              >
                Send Reset Code
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit(handleResetPassword)} className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Resetting password for <span className="font-medium">{email}</span>
                <button
                  type="button"
                  className="ml-2 text-primary-600 hover:text-primary-700"
                  onClick={() => setStep('request')}
                >
                  Use different email
                </button>
              </div>

              <Input
                label="Reset Code"
                startAdornment={<Key className="w-4 h-4" />}
                {...registerReset('reset_code')}
                error={resetErrors.reset_code?.message}
                required
              />

              <div className="relative">
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  startAdornment={<Key className="w-4 h-4" />}
                  {...registerReset('new_password')}
                  error={resetErrors.new_password?.message}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  startAdornment={<Key className="w-4 h-4" />}
                  {...registerReset('confirm_password')}
                  error={resetErrors.confirm_password?.message}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-primary-600 hover:text-primary-700"
                >
                  Resend code
                </button>
                <span className="text-gray-500">Check your spam folder if needed</span>
              </div>

              <Button
                type="submit"
                isLoading={isLoading}
                disabled={isLoading}
                className="w-full"
                variant="secondary"
              >
                Reset Password
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
          )}
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Remembered your password?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;
