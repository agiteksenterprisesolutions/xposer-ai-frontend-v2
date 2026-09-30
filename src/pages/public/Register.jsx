// src/pages/public/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Shield,
  User,
  Mail,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Building,
  Briefcase,
  Phone,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { authAPI } from '../../api/auth';
import SocialAuthButtons from '../../components/auth/SocialAuthButtons';
import { toast } from 'react-toastify';

const Register = () => {
  const { orgSlug } = useParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const { user } = useAuthStore();

  // Updated Zod schema - properly handles optional fields
  const registerSchema = z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be less than 50 characters')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, dashes, and underscores'),
    email: z.string()
      .email('Invalid email address')
      .optional()
      .or(z.literal('').transform(() => undefined)), // Converts empty string to undefined
    full_name: z.string()
      .min(1, 'Full name is required')
      .max(100, 'Name too long')
      .trim(),
    phone: z.string()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    department: z.string()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    position: z.string()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirm_password: z.string(),
    agree_to_terms: z.boolean().refine(val => val === true, {
      message: 'You must agree to the terms and conditions',
    }),
  }).refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

  const {
    register: registerForm,
    handleSubmit,
    formState: { errors },
    watch,
    setError: setFormError,
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      full_name: '',
      phone: '',
      department: '',
      position: '',
      password: '',
      confirm_password: '',
      agree_to_terms: false,
    },
  });

  // Watch password for real-time validation
  const password = watch('password', '');

  // Update password checks
  React.useEffect(() => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
    setPasswordChecks(checks);
  }, [password]);

  // Clean data helper - removes empty strings
  const cleanFormData = (data) => {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== '' && value !== null && value !== undefined) {
        cleaned[key] = typeof value === 'string' ? value.trim() : value;
      }
    }
    return cleaned;
  };

  // In your handleRegister function in Register.jsx
  const handleRegister = async (formData) => {
    setIsLoading(true);
    setError('');

    try {
      // Remove confirm_password and agree_to_terms from submission
      const { confirm_password, agree_to_terms, ...userData } = formData;

      // CRITICAL FIX: Convert empty strings to null for backend
      const cleanedData = Object.fromEntries(
        Object.entries(userData).map(([key, value]) => {
          if (key === 'email' && (value === '' || value === null || value === undefined)) {
            return [key, null];  // Convert empty email to null
          }
          if (typeof value === 'string') {
            return [key, value.trim()]; // Trim other strings
          }
          return [key, value];
        })
      );

      console.log('Original user data:', userData);
      console.log('Cleaned data for backend:', cleanedData);

      // Call the store register method with CLEANED data
      const result = await register(cleanedData);

      console.log('Registration result:', result);

      if (result.success) {
        if (result.autoLoggedIn) {
          // Already logged in, redirect to dashboard
          navigate(`/${orgSlug}/dashboard`);
        } else {
          // Need to login separately
          toast.success('Registration successful! Please login.');
          navigate(`/${orgSlug}/login`);
        }
      } else {
        // Show error from store
        setError(result.error || 'Registration failed');

        // If there are field-specific errors, set them
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, message]) => {
            setError(field, {
              type: 'manual',
              message: message
            });
          });
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordCheckItem = ({ label, checked }) => (
    <div className="flex items-center">
      {checked ? (
        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
      ) : (
        <XCircle className="w-4 h-4 text-gray-300 mr-2" />
      )}
      <span className={`text-sm ${checked ? 'text-green-600' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="py-12 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-600 mt-2">
            Join our secure Xposer AI reporting platform
          </p>
        </div>

        <Card className="shadow-xl">
          <form onSubmit={handleSubmit(handleRegister)} className="space-y-6">
            {error && (
              <Alert variant="error">
                <div className="flex items-center">
                  {error}
                </div>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                startAdornment={<User className="w-4 h-4" />}
                {...registerForm('full_name')}
                error={errors.full_name?.message}
                required
              />

              <Input
                label="Username"
                startAdornment={<User className="w-4 h-4" />}
                {...registerForm('username')}
                error={errors.username?.message}
                helperText="This cannot be changed later"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email Address"
                type="email"
                startAdornment={<Mail className="w-4 h-4" />}
                {...registerForm('email')}
                error={errors.email?.message}
                helperText="Optional, but recommended for account recovery"
              />

              <Input
                label="Phone Number"
                type="tel"
                startAdornment={<Phone className="w-4 h-4" />}
                {...registerForm('phone')}
                error={errors.phone?.message}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Department"
                startAdornment={<Building className="w-4 h-4" />}
                {...registerForm('department')}
                error={errors.department?.message}
              />

              <Input
                label="Position"
                startAdornment={<Briefcase className="w-4 h-4" />}
                {...registerForm('position')}
                error={errors.position?.message}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className='relative'>
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  {...registerForm('password')}
                  error={errors.password?.message}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 translate-y-1 right-3 transform  text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 cursor-pointer" /> : <Eye className="w-4 h-4 cursor-pointer" />}
                </button>
              </div>

              <div className='relative'>
                <Input
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...registerForm('confirm_password')}
                  error={errors.confirm_password?.message}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute top-1/2 translate-y-1 right-3 transform  text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4 cursor-pointer" /> : <Eye className="w-4 h-4 cursor-pointer" />}
                </button>
              </div>
            </div>

            {/* Terms and Conditions */}
            {/* <div className="space-y-3">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  {...registerForm('agree_to_terms')}
                  className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  I agree to the{' '}
                  <Link to="/terms" className="text-primary-600 hover:text-primary-700 font-medium">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-primary-600 hover:text-primary-700 font-medium">
                    Privacy Policy
                  </Link>
                  . I understand that this platform is for reporting workplace concerns only.
                </span>
              </label>
              {errors.agree_to_terms && (
                <p className="text-sm text-red-600">{errors.agree_to_terms.message}</p>
              )}
            </div> */}

            <Button
              type="submit"
              isLoading={isLoading}
              disabled={isLoading}
              className="w-full"
              variant="secondary"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

          <SocialAuthButtons
            onSuccess={(authUser) =>
              navigate(`/${authUser?.organization_slug || orgSlug}/dashboard`)
            }
            onError={setError}
            organizationSlug={orgSlug}
            disabled={isLoading}
            actionLabel="Sign up with"
          />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Already have an account?</span>
            </div>
          </div>

          <div className="space-y-3">
            <Link to="/login">
              <Button variant="secondary" className="w-full">
                Sign In to Existing Account
              </Button>
            </Link>

            <Link to="/submit-anonymous">
              <Button variant="ghost" className="w-full mt-2" >
                Or submit anonymously without account
              </Button>
            </Link>
          </div>
        </Card>


      </div>
    </div>
  );
};

export default Register;