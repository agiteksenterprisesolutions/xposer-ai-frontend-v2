import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Lock, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import { isSSOAccount, authProviderLabel } from '../../utils/authProviders';
import { changePasswordSchema } from '../../utils/passwordPolicy';
import { useTranslation } from 'react-i18next';

/** Show/hide toggle over a password field: a real button with a name. */
const RevealButton = ({ shown, onToggle }) => {
  const { t } = useTranslation('reporter');
  const Icon = shown ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? t('changePassword.hide') : t('changePassword.show')}
      aria-pressed={shown}
      className="absolute top-1/2 end-3 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:text-ink-secondary"
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
};

const ChangePassword = () => {
  const { t } = useTranslation('reporter');
  useSEO({
    title: t('seo.changePasswordTitle'),
    description: t('seo.changePasswordDescription'),
    noIndex: true,
  });
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const { orgSlug } = useParams();
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            current_password: '',
            new_password: '',
            confirm_password: '',
        },
    });

    const getOrgPath = () => {
        if (orgSlug) return `/${orgSlug}`;
        if (user?.organization_slug) return `/${user.organization_slug}`;
        return '';
    };

    const handleFormSubmit = async (data) => {
        setIsLoading(true);
        setErrorMessage('');

        try {
            await authAPI.changePassword({
                current_password: data.current_password,
                new_password: data.new_password,
            });
            reset();
            logout();
        } catch (error) {
            const message =
                error?.detail ||
                error?.message ||
                error?.response?.data?.detail ||
                error?.response?.data?.message ||
                t('changePassword.failed');
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    // The sidebar link is already hidden for SSO accounts, but the route is
    // still reachable by URL — and the backend answers it with a 400. Explain
    // why instead of letting the user fill in a form that cannot succeed.
    if (isSSOAccount(user)) {
        return (
            <div className="min-h-screen bg-subtle py-12">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Card className="shadow-lg">
                        <Alert variant="info" title={t('changePassword.ssoTitle')}>
                            {t('changePassword.ssoBody', { provider: authProviderLabel(user?.auth_provider) })}
                        </Alert>
                        <div className="mt-6">
                            <Button
                                variant="secondary"
                                onClick={() => navigate(`${getOrgPath()}/reporter/dashboard`)}
                                startIcon={ArrowLeft}
                            >
                                {t('changePassword.back')}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-subtle py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <button
                        type="button"
                        onClick={() => navigate(`${getOrgPath()}/reporter/dashboard`)}
                        className="inline-flex items-center text-sm font-medium text-ink-muted hover:text-ink transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 me-2" />
                        {t('changePassword.back')}
                    </button>
                </div>

                <Card className="shadow-lg">
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-soft text-accent-fg mb-4">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-semibold text-ink">{t('changePassword.title')}</h1>
                        <p className="text-sm text-ink-muted mt-2">
                            {t('changePassword.subtitle')}
                        </p>
                    </div>

                    {errorMessage && (
                        <Alert variant="error" className="mb-6">
                            <div className="flex items-start gap-2">
                                <span>{errorMessage}</span>
                            </div>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                        <div className="grid gap-6">
                            <div className="relative">
                                <Input
                                    label={t('changePassword.current')}
                                    autoComplete="current-password"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    startAdornment={<Lock className="w-4 h-4" />}
                                    {...register('current_password')}
                                    error={errors.current_password?.message}
                                    required
                                />
                                <RevealButton shown={showCurrentPassword} onToggle={() => setShowCurrentPassword(!showCurrentPassword)} />
                            </div>

                            <div className="relative">
                                <Input
                                    label={t('changePassword.new')}
                                    autoComplete="new-password"
                                    type={showNewPassword ? 'text' : 'password'}
                                    startAdornment={<Lock className="w-4 h-4" />}
                                    {...register('new_password')}
                                    error={errors.new_password?.message}
                                    required
                                />
                                <RevealButton shown={showNewPassword} onToggle={() => setShowNewPassword(!showNewPassword)} />
                            </div>

                            <div className="relative">
                                <Input
                                    label={t('changePassword.confirm')}
                                    autoComplete="new-password"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    startAdornment={<Lock className="w-4 h-4" />}
                                    {...register('confirm_password')}
                                    error={errors.confirm_password?.message}
                                    required
                                />
                                <RevealButton shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <p className="text-sm text-ink-muted">
                                {t('changePassword.hint')}
                            </p>
                            <Button type="submit" variant="secondary" fullWidth={false} isLoading={isLoading} className="w-full sm:w-auto">
                                {t('changePassword.update')}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default ChangePassword;
