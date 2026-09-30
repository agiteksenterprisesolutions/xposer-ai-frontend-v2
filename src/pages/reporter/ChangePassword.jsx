import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Lock, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import { isSSOAccount, authProviderLabel } from '../../utils/authProviders';

const changePasswordSchema = z.object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string()
        .min(8, 'New password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
});

const ChangePassword = () => {
  useSEO({
    title: 'Change Password',
    description: 'Update the password for your Xposer AI account.',
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
                'Failed to update password. Please try again.';
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
                        <Alert variant="info" title="Password managed by your sign-in provider">
                            Your account signs in with {authProviderLabel(user?.auth_provider)}, so
                            there is no password to change here. Manage your credentials in your{' '}
                            {authProviderLabel(user?.auth_provider)} account settings.
                        </Alert>
                        <div className="mt-6">
                            <Button
                                variant="secondary"
                                onClick={() => navigate(`${getOrgPath()}/reporter/dashboard`)}
                                startIcon={ArrowLeft}
                            >
                                Back to dashboard
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
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to dashboard
                    </button>
                </div>

                <Card className="shadow-lg">
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-soft text-accent-fg mb-4">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-semibold text-ink">Change Password</h1>
                        <p className="text-sm text-ink-muted mt-2">
                            Securely update your current reporter account password.
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
                                    label="Current Password"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    startAdornment={<Lock className="w-4 h-4" />}
                                    {...register('current_password')}
                                    error={errors.current_password?.message}
                                    required
                                />
                                {showCurrentPassword ? <EyeOff className='absolute top-1/2 right-4 transform -translate-y-1/2 cursor-pointer text-ink-muted hover:text-ink-secondary' size={18} onClick={() => setShowCurrentPassword(!showCurrentPassword)} /> : <Eye className='absolute top-1/2 right-4 transform -translate-y-1/2 cursor-pointer text-ink-muted hover:text-ink-secondary' size={18} onClick={() => setShowCurrentPassword(!showCurrentPassword)} />}
                            </div>

                            <div className="relative">
                                <Input
                                    label="New Password"
                                    type={showNewPassword ? 'text' : 'password'}
                                    startAdornment={<Lock className="w-4 h-4" />}
                                    {...register('new_password')}
                                    error={errors.new_password?.message}
                                    required
                                />
                                {showNewPassword ? <EyeOff className='absolute top-1/2 right-4 transform -translate-y-1/2 cursor-pointer text-ink-muted hover:text-ink-secondary' size={18} onClick={() => setShowNewPassword(!showNewPassword)} /> : <Eye className='absolute top-1/2 right-4 transform -translate-y-1/2 cursor-pointer text-ink-muted hover:text-ink-secondary' size={18} onClick={() => setShowNewPassword(!showNewPassword)} />}
                            </div>

                            <div className="relative">
                                <Input
                                    label="Confirm New Password"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    startAdornment={<Lock className="w-4 h-4" />}
                                    {...register('confirm_password')}
                                    error={errors.confirm_password?.message}
                                    required
                                />
                                {showConfirmPassword ? <EyeOff className='absolute top-1/2 right-4 transform -translate-y-1/2 cursor-pointer text-ink-muted hover:text-ink-secondary' size={18} onClick={() => setShowConfirmPassword(!showConfirmPassword)} /> : <Eye className='absolute top-1/2 right-4 transform -translate-y-1/2 cursor-pointer text-ink-muted hover:text-ink-secondary' size={18} onClick={() => setShowConfirmPassword(!showConfirmPassword)} />}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <p className="text-sm text-ink-muted">
                                Your current password is required to confirm the change.
                            </p>
                            <Button type="submit" variant="secondary" fullWidth={false} isLoading={isLoading} className="w-full sm:w-auto">
                                Update Password
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default ChangePassword;
