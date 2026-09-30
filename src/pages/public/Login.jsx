// src/pages/public/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Shield,
  Eye,
  EyeOff,
  Key,
  User,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import Tabs from '../../components/ui/Tabs';
import SocialAuthButtons from '../../components/auth/SocialAuthButtons';
import { reportsAPI } from '../../api/reports';
import { toast } from 'react-toastify';
import useSEO from '../../hooks/useSEO';
import { getHomePath, staffPath } from '../../utils/navigation';

const Login = () => {
  useSEO({
    title: 'Sign In',
    description: 'Sign in to your Xposer AI portal to submit, track, and manage reports securely.',
    noIndex: true,
  });
  const [loginType, setLoginType] = useState('account'); // 'account' or 'track'
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const { user } = useAuthStore();

  const from = location.state?.from?.pathname || `/${user ? user.organization_slug : '/'}/`;

  // The tab strip is driven by this list, so re-enabling "Track Report" is a
  // one-line uncomment — and the strip stays hidden while only one tab exists
  // rather than rendering a lone, pointless tab.
  const loginTabs = [
    { value: 'account', label: 'Account Login', icon: User },
    // { value: 'track', label: 'Track Report', icon: Key },
  ];

  // Schema for user login
  const userLoginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  });

  // Schema for reporter login
  const reporterLoginSchema = z.object({
    report_number: z.string().length(8, 'Report number must be 8 digits'),
    password: z.string().min(1, 'Password is required'),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginType === 'account' ? userLoginSchema : reporterLoginSchema),
  });

  /** Sends a freshly authenticated user to the first page their permissions
   *  open. Shared by the password form and the Google sign-in button. With no
   *  such page, the staff area's guard explains that instead of looping. */
  const redirectForUser = (authUser) => {
    navigate(getHomePath(authUser) || staffPath(authUser?.organization_slug));
  };

  const handleLogin = async (data) => {
    setIsLoading(true);
    setError('');

    try {
      if (loginType === 'account') {
        const result = await login(data.username, data.password);
        if (result.success) {
          redirectForUser(result.user);
        } else {
          setError(result.error || 'Login failed');
        }
      } else {
        // ANONYMOUS REPORT TRACKING - FIXED
        try {
          // Call the trackReport API with correct endpoint
          const reportData = await reportsAPI.trackReport({
            report_number: data.report_number,
            password: data.password
          });

          toast.success('Report found! Redirecting to report details...');

          // Navigate to the report details page with the tracked report data
          navigate(`/${user?.organization_slug}/report-details/${reportData.id}`, {
            state: {
              report: reportData,
              password: data.password, // Pass password to allow fetching messages
              fromLogin: true
            }
          });
        } catch (trackError) {
          console.error('Track report error:', trackError);
          setError(trackError.response?.data?.detail || 'Invalid report number or password.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  /** The invite-only rejection is the error most users hit during rollout, so
   *  it gets an explanatory panel rather than the same red strip as a typo'd
   *  password. Every other backend message is written for end users and is
   *  shown verbatim. */
  const renderError = () => {
    if (!error) return null;

    const isNoAccount = /no account exists/i.test(error);
    const isRateLimited = /too many failed sign-in attempts/i.test(error);

    if (isNoAccount) {
      return (
        <Alert variant="warning" title="No account yet">
          <p>{error}</p>
          <p className="mt-2 text-xs">
            Access is invite-only — signing in with Google or Microsoft does not
            create an account on its own.
          </p>
        </Alert>
      );
    }

    return (
      <Alert variant={isRateLimited ? 'warning' : 'error'}>
        {error}
      </Alert>
    );
  };

  /** Shared eye toggle. Lives in the field's endAdornment so it stays centred
   *  on the input even when a validation message pushes the wrapper taller. */
  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="text-ink-subtle transition-colors hover:text-ink"
      tabIndex={-1}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-canvas px-4 py-10 sm:py-14">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14  border border-line-accent rounded-xl mb-4">
            <img src="/logo-mark.svg" alt="Logo" className="w-10 h-10" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-[-0.02em]">
            Welcome Back
          </h1>
          <p className="text-sm text-ink-muted mt-2">
            Sign in to access your secure portal
          </p>
        </div>

        <Card shadow="lg" padding="large">
          {/* Login Type Tabs */}
          <Tabs value={loginType} onChange={setLoginType}>
            {loginTabs.length > 1 && (
              <Tabs.List className="mb-6">
                {loginTabs.map(({ value, label, icon: Icon }) => (
                  <Tabs.Trigger key={value} value={value} className="flex-1">
                    <span className="flex items-center justify-center gap-2">
                      <Icon className="w-4 h-4" />
                      {label}
                    </span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            )}

            {/* Account Login Tab */}
            <Tabs.Content value="account" className="mt-0">
              <form onSubmit={handleSubmit(handleLogin)} className="space-y-5">
                {renderError()}

                <Input
                  label="Username or email"
                  startAdornment={<User className="w-4 h-4" />}
                  autoComplete="username"
                  helperText="You can sign in with either your username or your email address."
                  {...register('username')}
                  error={errors.username?.message}
                  autoFocus
                />

                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  startAdornment={<Key className="w-4 h-4" />}
                  endAdornment={passwordToggle}
                  autoComplete="current-password"
                  {...register('password')}
                  error={errors.password?.message}
                />

                {/* <div className="flex justify-end">
                  <Link
                    to="/forget-password"
                    className="text-sm text-link hover:text-link-hover"
                  >
                    Forgot password?
                  </Link>
                </div> */}

                <Button
                  type="submit"
                  isLoading={isLoading}
                  disabled={isLoading}
                  fullWidth
                  size="large"
                  variant="primary"
                  endIcon={ArrowRight}
                >
                  Sign In
                </Button>
              </form>

              <SocialAuthButtons
                onSuccess={redirectForUser}
                onError={setError}
                organizationSlug={user?.organization_slug}
                disabled={isLoading}
              />
            </Tabs.Content>

            {/* Anonymous Tracking Tab */}
            <Tabs.Content value="track" className="mt-0">
              <form onSubmit={handleSubmit(handleLogin)} className="space-y-5">
                {renderError()}

                <Input
                  label="Report Number"
                  startAdornment={<Key className="w-4 h-4" />}
                  {...register('report_number')}
                  error={errors.report_number?.message}
                  helperText="Found in your report confirmation email"
                  maxLength={8}
                  pattern="[A-Z0-9]{8}"
                  title="8-digit alphanumeric code"
                  className="font-mono tracking-wider"
                />

                <Input
                  label="Report Password"
                  type={showPassword ? 'text' : 'password'}
                  startAdornment={<Key className="w-4 h-4" />}
                  endAdornment={passwordToggle}
                  {...register('password')}
                  error={errors.password?.message}
                  helperText="Provided when you submitted the report"
                />

                <Button
                  type="submit"
                  isLoading={isLoading}
                  disabled={isLoading}
                  fullWidth
                  size="large"
                  variant="primary"
                  endIcon={ArrowRight}
                >
                  Track Report
                </Button>
              </form>
            </Tabs.Content>
          </Tabs>

          {/* Quick Actions */}
          {/* <div className="space-y-3 mt-6">
            <Link to="/submit-anonymous">
              <Button variant="secondary" fullWidth>
                Submit Anonymous Report
              </Button>
            </Link>

            <Link to="/register">
              <Button variant="ghost" fullWidth>
                Create New Account
              </Button>
            </Link>
          </div> */}
        </Card>

        {/* Footer Links */}
        {/* <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-ink-muted">
            Need help?{' '}
            <Link to="/help" className="text-link hover:text-link-hover font-medium">
              Contact Support
            </Link>
          </p>
          <p className="text-xs text-ink-subtle leading-relaxed">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-link hover:text-link-hover">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-link hover:text-link-hover">
              Privacy Policy
            </Link>
          </p>
        </div> */}
      </div>
    </div>
  );
};

export default Login;
