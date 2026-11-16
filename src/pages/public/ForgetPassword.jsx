// src/pages/public/ForgetPassword.jsx
import React, { useMemo, useState } from 'react';
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
  ArrowLeft,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { authAPI } from '../../api/auth';
import { toast } from 'react-toastify';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';

// Built per render language so validation messages follow the interface.
const makeEmailSchema = (t) => z.object({
  email: z.string().email(t('forgot.errors.email')),
});

const makeResetSchema = (t) => z.object({
  reset_code: z.string().min(4, t('forgot.errors.codeRequired')),
  new_password: z.string()
    .min(8, t('forgot.errors.minLength'))
    .regex(/[A-Z]/, t('forgot.errors.uppercase'))
    .regex(/[a-z]/, t('forgot.errors.lowercase'))
    .regex(/[0-9]/, t('forgot.errors.number'))
    .regex(/[^A-Za-z0-9]/, t('forgot.errors.special')),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: t('forgot.errors.mismatch'),
  path: ['confirm_password'],
});

const ForgetPassword = () => {
  const { t } = useTranslation('public');
  const emailSchema = useMemo(() => makeEmailSchema(t), [t]);
  const resetSchema = useMemo(() => makeResetSchema(t), [t]);
  useSEO({
    title: t('forgot.seo.title'),
    description: t('forgot.seo.description'),
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
      toast.success(t('forgot.toast.sent'));
    } catch (err) {
      setError(err.response?.data?.detail || t('forgot.errors.sendFailed'));
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
      toast.success(t('forgot.toast.reset'));
      navigate(`/${user ? user.organization_slug : ''}/login`);
    } catch (err) {
      setError(err.response?.data?.detail || t('forgot.errors.resetFailed'));
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
      toast.success(t('forgot.toast.resent'));
    } catch (err) {
      setError(err.response?.data?.detail || t('forgot.errors.resendFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-soft rounded-full mb-4">
            <Shield className="h-8 w-8 text-link" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-ink">{t('forgot.title')}</h1>
          <p className="text-ink-muted mt-2">
            {step === 'request' ? t('forgot.subtitleRequest') : t('forgot.subtitleReset')}
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
                label={t('forgot.fields.email')}
                autoComplete="email"
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
                {t('forgot.sendCode')}
                <ArrowRight className="ms-2 w-4 h-4" aria-hidden="true" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit(handleResetPassword)} className="space-y-6">
              <div className="rounded-lg border border-line bg-subtle px-4 py-3 text-sm text-ink-secondary">
                {t('forgot.resettingFor')} <span className="font-medium" dir="ltr">{email}</span>
                <button
                  type="button"
                  className="ms-2 text-link hover:text-link-hover"
                  onClick={() => setStep('request')}
                >
                  {t('forgot.differentEmail')}
                </button>
              </div>

              <Input
                label={t('forgot.fields.code')}
                autoComplete="one-time-code"
                startAdornment={<Key className="w-4 h-4" />}
                {...registerReset('reset_code')}
                error={resetErrors.reset_code?.message}
                required
              />

              <div className="relative">
                <Input
                  label={t('forgot.fields.newPassword')}
                autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  startAdornment={<Key className="w-4 h-4" />}
                  {...registerReset('new_password')}
                  error={resetErrors.new_password?.message}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className="absolute top-1/2 end-3 transform -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label={t('forgot.fields.confirmPassword')}
                autoComplete="new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  startAdornment={<Key className="w-4 h-4" />}
                  {...registerReset('confirm_password')}
                  error={resetErrors.confirm_password?.message}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className="absolute top-1/2 end-3 transform -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-link hover:text-link-hover"
                >
                  {t('forgot.resend')}
                </button>
                <span className="text-ink-muted">{t('forgot.checkSpam')}</span>
              </div>

              <Button
                type="submit"
                isLoading={isLoading}
                disabled={isLoading}
                className="w-full"
                variant="secondary"
              >
                {t('forgot.submit')}
                <ArrowRight className="ms-2 w-4 h-4" aria-hidden="true" />
              </Button>
            </form>
          )}
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-ink-muted">
            {t('forgot.remembered')}{' '}
            <Link to="/login" className="text-link hover:text-link-hover font-medium">
              {t('forgot.signIn')}
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t('forgot.backHome')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;
