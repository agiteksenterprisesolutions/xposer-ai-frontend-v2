// src/components/forms/UserForm.jsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Building,
  Briefcase,
  Calendar,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input, { Select } from '../ui/Input';
import Alert from '../ui/Alert';
import { useOrgRoles, REPORTER_ROLE } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';

const UserForm = ({
  user = null,
  onSubmit,
  isLoading = false,
  isEditing = false,
  allowRoleChange = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    strength: 'weak',
    checks: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    },
  });

  // Role options come from the organization's own roles; reporter is the
  // self-service identity the endpoint never lists. Whether the role can be
  // changed at all is a permission, not a matter of who is asking.
  const { roles: orgRoles } = useOrgRoles();
  const can = useCan();
  const canChangeRole = allowRoleChange && can(PERM.userManageRoles);
  const getRoleOptions = () => [
    { value: REPORTER_ROLE, label: 'Reporter (self-service)' },
    ...orgRoles.map((role) => ({ value: role.code, label: role.name })),
  ];

  // Validation schema
  const userSchema = z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be less than 50 characters')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, dashes, and underscores'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    full_name: z.string().optional(),
    phone: z.string().optional(),
    department: z.string().optional(),
    position: z.string().optional(),
    // Any code: roles are organization-defined, and the server validates it.
    role: z.string().min(1, 'Choose a role'),
    is_active: z.boolean().default(true),
  }).refine((data) => {
    // If editing and password is provided, validate it
    if (isEditing && data.password) {
      return data.password.length >= 8;
    }
    return true;
  }, {
    message: "Password must be at least 8 characters",
    path: ["password"],
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      department: user?.department || '',
      position: user?.position || '',
      role: user?.role || REPORTER_ROLE,
      is_active: user?.is_active ?? true,
    },
  });

  // Watch password for strength checking
  const password = watch('password', '');

  // Check password strength
  useEffect(() => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    let strength = 'weak';
    if (score === 5) strength = 'strong';
    else if (score >= 3) strength = 'medium';
    
    setPasswordStrength({
      score,
      strength,
      checks,
    });
  }, [password]);

  // Handle form submission
  const handleFormSubmit = async (data) => {
    // Remove empty fields
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => 
        value !== '' && value !== undefined && value !== null
      )
    );
    
    await onSubmit(cleanedData);
  };

  // Render password strength meter
  const renderPasswordStrength = () => {
    if (!password) return null;
    
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-ink-secondary">
            Password strength: 
            <span className={`ml-1 ${
              passwordStrength.strength === 'strong' ? 'text-success-fg' :
              passwordStrength.strength === 'medium' ? 'text-warning-fg' : 'text-danger-fg'
            }`}>
              {passwordStrength.strength}
            </span>
          </span>
          <span className="text-xs text-ink-muted">
            {passwordStrength.score}/5
          </span>
        </div>
        <div className="h-1 w-full bg-active rounded-full overflow-hidden">
          <div
            className={`h-full ${
              passwordStrength.strength === 'strong' ? 'bg-success-solid' :
              passwordStrength.strength === 'medium' ? 'bg-warning-solid' : 'bg-danger-solid'
            }`}
            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
          ></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
          {Object.entries(passwordStrength.checks).map(([key, value]) => (
            <div key={key} className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-1 ${
                value ? 'bg-success-solid' : 'bg-active'
              }`}></div>
              <span className="text-xs text-ink-muted capitalize">
                {key.replace('has', '').replace('uppercase', 'A-Z').replace('lowercase', 'a-z')}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-ink mb-4">
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Username"
                startAdornment={<User className="w-4 h-4" />}
                {...register('username')}
                error={errors.username?.message}
                required={!isEditing}
                disabled={isEditing}
                helperText={isEditing ? "Username cannot be changed" : ""}
              />
              
              <Input
                label="Email Address"
                type="email"
                startAdornment={<Mail className="w-4 h-4" />}
                {...register('email')}
                error={errors.email?.message}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Input
                label="Full Name"
                startAdornment={<User className="w-4 h-4" />}
                {...register('full_name')}
                error={errors.full_name?.message}
              />
              
              <Input
                label="Phone Number"
                type="tel"
                startAdornment={<Phone className="w-4 h-4" />}
                {...register('phone')}
                error={errors.phone?.message}
              />
            </div>
          </div>
          
          {/* Company Information */}
          <div>
            <h3 className="text-lg font-semibold text-ink mb-4">
              Company Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Department"
                startAdornment={<Building className="w-4 h-4" />}
                {...register('department')}
                error={errors.department?.message}
              />
              
              <Input
                label="Position"
                startAdornment={<Briefcase className="w-4 h-4" />}
                {...register('position')}
                error={errors.position?.message}
              />
            </div>
          </div>
          
          {/* Role & Permissions */}
          <div>
            <h3 className="text-lg font-semibold text-ink mb-4">
              Role & Permissions
            </h3>
            
            <div className="space-y-4">
              <Select
                label="User Role"
                startAdornment={<Shield className="w-4 h-4" />}
                {...register('role')}
                error={errors.role?.message}
                options={getRoleOptions()}
                disabled={!canChangeRole}
                helperText={!canChangeRole ? "Changing roles needs the user:manage_roles permission" : ""}
              />
              
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('is_active')}
                    className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
                  />
                  <span className="ml-2 text-sm text-ink-secondary">
                    Active Account
                  </span>
                </label>
              </div>
              
              {/* Role descriptions */}
              <div className="p-3 bg-subtle rounded-lg">
                <h4 className="text-sm font-medium text-ink mb-2">
                  Role Descriptions:
                </h4>
                <ul className="text-xs text-ink-muted space-y-1">
                  <li><strong>Reporter:</strong> Can submit and track reports</li>
                  <li><strong>Officer:</strong> Can investigate assigned reports</li>
                  <li><strong>Reviewer:</strong> Read-only access to all reports</li>
                  <li><strong>Manager:</strong> Can assign reports and manage team</li>
                  <li><strong>Admin:</strong> Full system access</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Password Section */}
          <div>
            <h3 className="text-lg font-semibold text-ink mb-4">
              {isEditing ? 'Change Password' : 'Set Password'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <Input
                  label={isEditing ? "New Password (leave blank to keep current)" : "Password"}
                  type={showPassword ? 'text' : 'password'}
                  startAdornment={<Lock className="w-4 h-4" />}
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-ink-muted hover:text-ink-secondary"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  {...register('password')}
                  error={errors.password?.message}
                  required={!isEditing}
                  helperText={isEditing ? "Leave blank to keep current password" : "Password must be at least 8 characters"}
                />
                {renderPasswordStrength()}
              </div>
              
              {!isEditing && (
                <div>
                  <Input
                    label="Confirm Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    startAdornment={<Lock className="w-4 h-4" />}
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="text-ink-muted hover:text-ink-secondary"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    {...register('confirm_password')}
                    error={errors.confirm_password?.message}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.history.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {isEditing ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
};

// Profile form for users to edit their own information
export const ProfileForm = ({ user, onSubmit, isLoading = false }) => {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const profileSchema = z.object({
    full_name: z.string().optional(),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional(),
    department: z.string().optional(),
    position: z.string().optional(),
    current_password: z.string().optional(),
    new_password: z.string().optional(),
    confirm_password: z.string().optional(),
  }).refine((data) => {
    // If new password is provided, validate it
    if (data.new_password) {
      return data.new_password.length >= 8;
    }
    return true;
  }, {
    message: "New password must be at least 8 characters",
    path: ["new_password"],
  }).refine((data) => {
    // If new password is provided, confirm password must match
    if (data.new_password) {
      return data.new_password === data.confirm_password;
    }
    return true;
  }, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      department: user?.department || '',
      position: user?.position || '',
    },
  });

  const handleFormSubmit = async (data) => {
    // Clean up data
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => 
        value !== '' && value !== undefined && value !== null
      )
    );
    
    // Remove confirm_password from submission
    delete cleanedData.confirm_password;
    
    await onSubmit(cleanedData);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-ink mb-4">
              Personal Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                startAdornment={<User className="w-4 h-4" />}
                {...register('full_name')}
                error={errors.full_name?.message}
              />
              
              <Input
                label="Email Address"
                type="email"
                startAdornment={<Mail className="w-4 h-4" />}
                {...register('email')}
                error={errors.email?.message}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Input
                label="Phone Number"
                type="tel"
                startAdornment={<Phone className="w-4 h-4" />}
                {...register('phone')}
                error={errors.phone?.message}
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-ink mb-4">
              Company Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Department"
                startAdornment={<Building className="w-4 h-4" />}
                {...register('department')}
                error={errors.department?.message}
              />
              
              <Input
                label="Position"
                startAdornment={<Briefcase className="w-4 h-4" />}
                {...register('position')}
                error={errors.position?.message}
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-ink mb-4">
              Change Password
            </h3>
            
            <div className="space-y-4">
              <Input
                label="Current Password"
                type={showCurrentPassword ? 'text' : 'password'}
                startAdornment={<Lock className="w-4 h-4" />}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="text-ink-muted hover:text-ink-secondary"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...register('current_password')}
                error={errors.current_password?.message}
                helperText="Required only if changing password"
              />
              
              <Input
                label="New Password"
                type={showNewPassword ? 'text' : 'password'}
                startAdornment={<Lock className="w-4 h-4" />}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-ink-muted hover:text-ink-secondary"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...register('new_password')}
                error={errors.new_password?.message}
                helperText="Leave blank to keep current password"
              />
              
              <Input
                label="Confirm New Password"
                type={showConfirmPassword ? 'text' : 'password'}
                startAdornment={<Lock className="w-4 h-4" />}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-ink-muted hover:text-ink-secondary"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...register('confirm_password')}
                error={errors.confirm_password?.message}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-6 border-t border-line">
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
};

export default UserForm;