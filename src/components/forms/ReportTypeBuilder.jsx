// src/components/forms/ReportTypeBuilder.jsx
import { useState } from 'react';
import {
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Copy,
  Eye,
  Settings,
  HelpCircle,
  Text,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Grid,
  Upload,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  GitBranch,
  X,
  GripVertical,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  LayoutTemplate,
  FileText,
  Layers,
  Sparkles,
  Shield,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import Alert from '../ui/Alert';

const normalizeOption = (option) => {
  if (typeof option === 'string') {
    return { value: option, label: option };
  }

  if (option && typeof option === 'object') {
    return {
      value: option.value ?? option.label ?? '',
      label: option.label ?? option.value ?? '',
    };
  }

  return { value: '', label: '' };
};

const normalizeQuestionType = (type) => {
  const normalized = String(type || '').toLowerCase().replace(/_/g, '-');
  if (normalized === 'date-time') return 'datetime';
  return normalized;
};

const normalizeSections = (sections = []) =>
  sections.map((section) => ({
    ...section,
    questions: (section.questions || []).map((question) => ({
      ...question,
      type: normalizeQuestionType(question.type) || 'text',
      options: Array.isArray(question.options)
        ? question.options.map(normalizeOption)
        : [],
    })),
  }));

const ReportTypeBuilder = ({
  initialData = null,
  onSubmit,
  isLoading = false,
  // View mode: the builder is locked to its preview so the page shows only what
  // a reporter would see. `onEdit` swaps the preview's "Edit Form" toggle for a
  // link out to the real edit page.
  readOnly = false,
  onEdit,
  onBack,
}) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    is_active: initialData?.is_active ?? true,
    sections: normalizeSections(initialData?.sections || []),
  });

  const [errors, setErrors] = useState({});
  // In view mode the preview is the whole page, and there is no way back to
  // the builder controls.
  const [previewMode, setPreviewMode] = useState(readOnly);
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [expandedQuestionsPanels, setExpandedQuestionsPanels] = useState({});
  const [autoGenerateFieldName, setAutoGenerateFieldName] = useState(true);
  const [expandedConditionalLogic, setExpandedConditionalLogic] = useState({});
  const [activeTab, setActiveTab] = useState('builder');

  // Question type options with enhanced styling
  const questionTypeOptions = [
    { value: 'text', label: 'Single Line Text', icon: Type, color: 'blue' },
    { value: 'textarea', label: 'Multi-line Text', icon: Text, color: 'indigo' },
    { value: 'number', label: 'Number', icon: Hash, color: 'emerald' },
    { value: 'email', label: 'Email', icon: Mail, color: 'violet' },
    { value: 'phone', label: 'Phone Number', icon: Phone, color: 'cyan' },
    { value: 'date', label: 'Date', icon: Calendar, color: 'amber' },
    { value: 'datetime', label: 'Date & Time', icon: Calendar, color: 'orange' },
    { value: 'select', label: 'Dropdown', icon: List, color: 'pink' },
    { value: 'multiselect', label: 'Multiple Choice', icon: Grid, color: 'fuchsia' },
    { value: 'boolean', label: 'Yes/No', icon: CheckSquare, color: 'teal' },
    { value: 'file', label: 'File Upload', icon: Upload, color: 'rose' },
  ];

  const operatorOptions = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
  ];

  const conditionTypeOptions = [
    { value: 'show', label: 'Show' },
    { value: 'skip', label: 'Skip' },
  ];

  // Color schemes for sections to differentiate them visually. `fg` is the
  // readable foreground for the solid `accent` fill — it has to differ per
  // family, since the brand blue and the amber warning need opposite inks.
  const sectionColors = [
    { bg: 'bg-accent-soft', border: 'border-line-accent', accent: 'bg-accent', fg: 'text-on-accent', text: 'text-accent-fg', light: 'bg-accent-soft' },
    { bg: 'bg-success-soft', border: 'border-success-line', accent: 'bg-success-solid', fg: 'text-white', text: 'text-success-fg', light: 'bg-success-soft' },
    { bg: 'bg-accent-soft', border: 'border-line-accent', accent: 'bg-accent', fg: 'text-on-accent', text: 'text-accent-fg', light: 'bg-accent-soft' },
    { bg: 'bg-warning-soft', border: 'border-warning-line', accent: 'bg-warning-solid', fg: 'text-ink-inverse', text: 'text-warning-fg', light: 'bg-warning-soft' },
    { bg: 'bg-danger-soft', border: 'border-danger-line', accent: 'bg-danger-solid', fg: 'text-white', text: 'text-danger-fg', light: 'bg-danger-soft' },
    { bg: 'bg-info-soft', border: 'border-info-line', accent: 'bg-info-solid', fg: 'text-on-accent', text: 'text-info-fg', light: 'bg-info-soft' },
  ];

  const getSectionColor = (index) => sectionColors[index % sectionColors.length];

  const generateFieldName = (label) => {
    if (!label || !label.trim()) return '';

    let fieldName = label.toLowerCase().trim();
    fieldName = fieldName.replace(/[^a-zA-Z0-9\s]/g, '');
    fieldName = fieldName.replace(/\s+/g, '_');
    fieldName = fieldName.replace(/_{2,}/g, '_');
    fieldName = fieldName.replace(/^_+|_+$/g, '');

    if (!/^[a-zA-Z]/.test(fieldName)) {
      fieldName = 'field_' + fieldName;
    }

    if (!fieldName) {
      fieldName = 'field_' + Date.now().toString().slice(-4);
    }

    return fieldName;
  };

  const isFieldNameUnique = (fieldName, currentSectionIndex, currentQuestionIndex) => {
    let isUnique = true;
    let duplicateLocations = [];

    formData.sections.forEach((section, sectionIndex) => {
      section.questions.forEach((question, questionIndex) => {
        if (question.name === fieldName) {
          if (!(sectionIndex === currentSectionIndex && questionIndex === currentQuestionIndex)) {
            isUnique = false;
            duplicateLocations.push({
              section: section.title || `Section ${sectionIndex + 1}`,
              question: question.label || `Question ${questionIndex + 1}`
            });
          }
        }
      });
    });

    return { isUnique, duplicateLocations };
  };

  const getPreviousQuestions = (currentSectionIndex, currentQuestionIndex = null) => {
    const previousQuestions = [];

    for (let i = 0; i < currentSectionIndex; i++) {
      const section = formData.sections[i];
      section.questions.forEach(question => {
        previousQuestions.push({
          ...question,
          sectionTitle: section.title,
          sectionIndex: i,
        });
      });
    }

    if (currentQuestionIndex !== null) {
      const currentSection = formData.sections[currentSectionIndex];
      for (let i = 0; i < currentQuestionIndex; i++) {
        const question = currentSection.questions[i];
        previousQuestions.push({
          ...question,
          sectionTitle: currentSection.title,
          sectionIndex: currentSectionIndex,
        });
      }
    }

    return previousQuestions;
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: '',
      description: '',
      order: formData.sections.length,
      questions: [],
      conditional_logic: null,
    };

    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));

    setExpandedSections(prev => ({
      ...prev,
      [newSection.id]: true
    }));

    setExpandedQuestionsPanels(prev => ({
      ...prev,
      [newSection.id]: true
    }));
  };

  const updateSection = (index, field, value) => {
    const updatedSections = [...formData.sections];
    updatedSections[index] = {
      ...updatedSections[index],
      [field]: value
    };

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const removeSection = (index) => {
    if (!window.confirm('Are you sure you want to delete this section and all its questions?')) return;

    const updatedSections = formData.sections.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const moveSection = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === formData.sections.length - 1)
    ) {
      return;
    }

    const updatedSections = [...formData.sections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updatedSections[index], updatedSections[newIndex]] =
      [updatedSections[newIndex], updatedSections[index]];

    updatedSections.forEach((section, i) => {
      section.order = i;
    });

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const addQuestionToSection = (sectionIndex) => {
    const newQuestion = {
      id: `question_${Date.now()}`,
      type: 'text',
      label: '',
      name: '',
      required: false,
      placeholder: '',
      help_text: '',
      options: [],
      validation: {},
      conditional_logic: null,
      order: formData.sections[sectionIndex].questions.length,
    };

    const updatedSections = [...formData.sections];
    updatedSections[sectionIndex].questions.push(newQuestion);

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));

    // Auto-expand the newly added question
    setExpandedQuestions(prev => ({
      ...prev,
      [newQuestion.id]: true
    }));
  };

  const updateQuestionInSection = (sectionIndex, questionIndex, field, value) => {
    const updatedSections = [...formData.sections];
    const updatedQuestions = [...updatedSections[sectionIndex].questions];

    const oldQuestion = updatedQuestions[questionIndex];
    const updatedQuestion = {
      ...oldQuestion,
      [field]: value
    };

    if (field === 'label' && autoGenerateFieldName && value.trim()) {
      const generatedName = generateFieldName(value);
      const { isUnique } = isFieldNameUnique(generatedName, sectionIndex, questionIndex);

      let finalName = generatedName;
      if (!isUnique) {
        let counter = 1;
        while (!isFieldNameUnique(`${generatedName}_${counter}`, sectionIndex, questionIndex).isUnique) {
          counter++;
        }
        finalName = `${generatedName}_${counter}`;
      }

      updatedQuestion.name = finalName;

      const errorKey = `sections[${sectionIndex}].questions[${questionIndex}].name`;
      if (errors[errorKey]) {
        setErrors(prev => ({
          ...prev,
          [errorKey]: undefined
        }));
      }
    }

    if (field === 'type') {
      updatedQuestion.validation = {};
      if (!['select', 'multiselect'].includes(value)) {
        updatedQuestion.options = [];
      }
    }

    updatedQuestions[questionIndex] = updatedQuestion;
    updatedSections[sectionIndex].questions = updatedQuestions;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const updateFieldName = (sectionIndex, questionIndex, value) => {
    const updatedSections = [...formData.sections];
    const updatedQuestions = [...updatedSections[sectionIndex].questions];

    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      name: value
    };

    updatedSections[sectionIndex].questions = updatedQuestions;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const regenerateFieldName = (sectionIndex, questionIndex) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    if (!question.label.trim()) return;

    const generatedName = generateFieldName(question.label);
    const { isUnique } = isFieldNameUnique(generatedName, sectionIndex, questionIndex);

    let finalName = generatedName;
    if (!isUnique) {
      let counter = 1;
      while (!isFieldNameUnique(`${generatedName}_${counter}`, sectionIndex, questionIndex).isUnique) {
        counter++;
      }
      finalName = `${generatedName}_${counter}`;
    }

    updateFieldName(sectionIndex, questionIndex, finalName);

    const errorKey = `sections[${sectionIndex}].questions[${questionIndex}].name`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: undefined
      }));
    }
  };

  const removeQuestionFromSection = (sectionIndex, questionIndex) => {
    if (!window.confirm('Delete this question?')) return;

    const updatedSections = [...formData.sections];
    const updatedQuestions = updatedSections[sectionIndex].questions.filter(
      (_, i) => i !== questionIndex
    );
    updatedSections[sectionIndex].questions = updatedQuestions;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const moveQuestionInSection = (sectionIndex, questionIndex, direction) => {
    const questions = formData.sections[sectionIndex].questions;

    if (
      (direction === 'up' && questionIndex === 0) ||
      (direction === 'down' && questionIndex === questions.length - 1)
    ) {
      return;
    }

    const updatedSections = [...formData.sections];
    const updatedQuestions = [...updatedSections[sectionIndex].questions];
    const newQuestionIndex = direction === 'up' ? questionIndex - 1 : questionIndex + 1;

    [updatedQuestions[questionIndex], updatedQuestions[newQuestionIndex]] =
      [updatedQuestions[newQuestionIndex], updatedQuestions[questionIndex]];

    updatedQuestions.forEach((q, i) => {
      q.order = i;
    });

    updatedSections[sectionIndex].questions = updatedQuestions;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const duplicateQuestionInSection = (sectionIndex, questionIndex) => {
    const questionToDuplicate = formData.sections[sectionIndex].questions[questionIndex];

    const baseName = questionToDuplicate.name.replace(/_copy(\d+)?$/, '');
    let duplicateName = `${baseName}_copy`;
    let counter = 1;

    while (!isFieldNameUnique(duplicateName, sectionIndex, questionIndex).isUnique) {
      duplicateName = `${baseName}_copy${counter}`;
      counter++;
    }

    const duplicatedQuestion = {
      ...questionToDuplicate,
      id: `question_${Date.now()}`,
      name: duplicateName,
      label: `${questionToDuplicate.label} (Copy)`,
    };

    const updatedSections = [...formData.sections];
    const updatedQuestions = [
      ...updatedSections[sectionIndex].questions.slice(0, questionIndex + 1),
      duplicatedQuestion,
      ...updatedSections[sectionIndex].questions.slice(questionIndex + 1)
    ];

    updatedSections[sectionIndex].questions = updatedQuestions;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const addOptionToQuestion = (sectionIndex, questionIndex) => {
    const updatedSections = [...formData.sections];
    const updatedQuestion = updatedSections[sectionIndex].questions[questionIndex];
    const options = updatedQuestion.options || [];
    updatedQuestion.options = [
      ...options,
      { value: "", label: "" }
    ];

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const updateOptionInQuestion = (sectionIndex, questionIndex, optionIndex, field, value) => {
    const updatedSections = [...formData.sections];
    const updatedOptions = [...updatedSections[sectionIndex].questions[questionIndex].options];
    const currentOption = normalizeOption(updatedOptions[optionIndex]);
    updatedOptions[optionIndex] = {
      ...currentOption,
      [field]: value
    };
    updatedSections[sectionIndex].questions[questionIndex].options = updatedOptions;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const removeOptionFromQuestion = (sectionIndex, questionIndex, optionIndex) => {
    const updatedSections = [...formData.sections];
    const updatedOptions = updatedSections[sectionIndex].questions[questionIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    updatedSections[sectionIndex].questions[questionIndex].options = updatedOptions;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const updateValidationInQuestion = (sectionIndex, questionIndex, field, value) => {
    const updatedSections = [...formData.sections];
    const updatedQuestion = updatedSections[sectionIndex].questions[questionIndex];
    updatedQuestion.validation = {
      ...updatedQuestion.validation,
      [field]: value
    };

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  // Conditional Logic Functions
  const toggleSectionConditionalLogic = (sectionIndex) => {
    const updatedSections = [...formData.sections];
    const section = updatedSections[sectionIndex];

    if (section.conditional_logic) {
      section.conditional_logic = null;
    } else {
      section.conditional_logic = {
        rules: [],
        logic_type: 'and'
      };
    }

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const toggleQuestionConditionalLogic = (sectionIndex, questionIndex) => {
    const updatedSections = [...formData.sections];
    const question = updatedSections[sectionIndex].questions[questionIndex];

    if (question.conditional_logic) {
      question.conditional_logic = null;
    } else {
      question.conditional_logic = {
        rules: [],
        logic_type: 'and'
      };
    }

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const addConditionRuleToSection = (sectionIndex) => {
    const updatedSections = [...formData.sections];
    const section = updatedSections[sectionIndex];

    if (!section.conditional_logic) {
      section.conditional_logic = { rules: [], logic_type: 'and' };
    }

    section.conditional_logic.rules.push({
      condition_type: 'show',
      when_question: '',
      operator: 'equals',
      value: '',
      values: null
    });

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const addConditionRuleToQuestion = (sectionIndex, questionIndex) => {
    const updatedSections = [...formData.sections];
    const question = updatedSections[sectionIndex].questions[questionIndex];

    if (!question.conditional_logic) {
      question.conditional_logic = { rules: [], logic_type: 'and' };
    }

    question.conditional_logic.rules.push({
      condition_type: 'show',
      when_question: '',
      operator: 'equals',
      value: '',
      values: null
    });

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const updateSectionConditionRule = (sectionIndex, ruleIndex, field, value) => {
    const updatedSections = [...formData.sections];
    const rule = updatedSections[sectionIndex].conditional_logic.rules[ruleIndex];

    rule[field] = value;

    if (field === 'operator') {
      if (value === 'in' || value === 'not_in') {
        rule.values = rule.value ? [rule.value] : [];
        rule.value = null;
      } else {
        rule.value = rule.values && rule.values.length > 0 ? rule.values[0] : '';
        rule.values = null;
      }
    }

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const updateQuestionConditionRule = (sectionIndex, questionIndex, ruleIndex, field, value) => {
    const updatedSections = [...formData.sections];
    const rule = updatedSections[sectionIndex].questions[questionIndex].conditional_logic.rules[ruleIndex];

    rule[field] = value;

    if (field === 'operator') {
      if (value === 'in' || value === 'not_in') {
        rule.values = rule.value ? [rule.value] : [];
        rule.value = null;
      } else {
        rule.value = rule.values && rule.values.length > 0 ? rule.values[0] : '';
        rule.values = null;
      }
    }

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const removeSectionConditionRule = (sectionIndex, ruleIndex) => {
    const updatedSections = [...formData.sections];
    updatedSections[sectionIndex].conditional_logic.rules =
      updatedSections[sectionIndex].conditional_logic.rules.filter((_, i) => i !== ruleIndex);

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const removeQuestionConditionRule = (sectionIndex, questionIndex, ruleIndex) => {
    const updatedSections = [...formData.sections];
    updatedSections[sectionIndex].questions[questionIndex].conditional_logic.rules =
      updatedSections[sectionIndex].questions[questionIndex].conditional_logic.rules.filter((_, i) => i !== ruleIndex);

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const updateSectionLogicType = (sectionIndex, logicType) => {
    const updatedSections = [...formData.sections];
    updatedSections[sectionIndex].conditional_logic.logic_type = logicType;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const updateQuestionLogicType = (sectionIndex, questionIndex, logicType) => {
    const updatedSections = [...formData.sections];
    updatedSections[sectionIndex].questions[questionIndex].conditional_logic.logic_type = logicType;

    setFormData(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const toggleConditionalExpansion = (key) => {
    setExpandedConditionalLogic(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderSectionConditionalLogic = (section, sectionIndex) => {
    const previousQuestions = getPreviousQuestions(sectionIndex);
    const colors = getSectionColor(sectionIndex);

    if (!section.conditional_logic) {
      return (
        <div className="mt-6 pt-6 border-t border-line">
          <button
            type="button"
            onClick={() => toggleSectionConditionalLogic(sectionIndex)}
            className="flex items-center gap-3 w-full group hover:bg-subtle p-3 rounded-lg transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-lg bg-active flex items-center justify-center group-hover:bg-surface group-hover:shadow-sm transition-all">
              <GitBranch className="w-5 h-5 text-ink-subtle group-hover:text-ink-muted" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-sm font-semibold text-ink-secondary block">Section Visibility Logic</span>
              <span className="text-xs text-ink-muted">Always visible • Click to add conditions</span>
            </div>
            <Plus className="w-5 h-5 text-ink-subtle group-hover:text-ink-muted" />
          </button>
        </div>
      );
    }

    if (previousQuestions.length === 0) {
      return (
        <div className="mt-6 pt-6 border-t border-line">
          <Alert variant="warning" className="mb-3">
            No previous questions available. Add questions to earlier sections first.
          </Alert>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => toggleSectionConditionalLogic(sectionIndex)}
            className="text-danger-fg hover:text-danger-fg"
          >
            Remove Conditions
          </Button>
        </div>
      );
    }

    const isExpanded = expandedConditionalLogic[`section_${sectionIndex}`];

    return (
      <div className="mt-6 pt-6 border-t border-line">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => toggleConditionalExpansion(`section_${sectionIndex}`)}
            className="flex items-center gap-3 flex-1 group"
          >
            <div className={`w-10 h-10 rounded-lg ${colors.light} flex items-center justify-center`}>
              <GitBranch className={`w-5 h-5 ${colors.text}`} />
            </div>
            <div className="flex-1 text-left">
              <span className="text-sm font-semibold text-ink block">Section Visibility Logic</span>
              <span className="text-xs text-ink-muted">
                {section.conditional_logic.rules.length} rule{section.conditional_logic.rules.length !== 1 ? 's' : ''} configured
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.light} ${colors.text}`}>
                {section.conditional_logic.logic_type.toUpperCase()}
              </span>
              {isExpanded ? <ChevronUp className="w-5 h-5 text-ink-subtle" /> : <ChevronDown className="w-5 h-5 text-ink-subtle" />}
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => toggleSectionConditionalLogic(sectionIndex)}
            className="text-danger-fg hover:text-danger-fg ml-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {isExpanded && (
          <div className={`${colors.bg} rounded-xl p-5 border ${colors.border} space-y-4`}>
            <div className="flex items-center gap-3 pb-4 border-b border-line">
              <span className="text-sm font-medium text-ink-secondary">Match Logic:</span>
              <div className="flex bg-surface rounded-lg p-1 border border-line shadow-sm">
                <button
                  type="button"
                  onClick={() => updateSectionLogicType(sectionIndex, 'and')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${section.conditional_logic.logic_type === 'and'
                    ? `${colors.accent} ${colors.fg} shadow-sm`
                    : 'text-ink-muted hover:bg-subtle'
                    }`}
                >
                  All (AND)
                </button>
                <button
                  type="button"
                  onClick={() => updateSectionLogicType(sectionIndex, 'or')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${section.conditional_logic.logic_type === 'or'
                    ? `${colors.accent} ${colors.fg} shadow-sm`
                    : 'text-ink-muted hover:bg-subtle'
                    }`}
                >
                  Any (OR)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {section.conditional_logic.rules.map((rule, ruleIndex) => (
                <div key={ruleIndex} className="bg-surface rounded-lg border border-line shadow-sm p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    <div className="sm:col-span-3 lg:col-span-2">
                      <label className="block text-xs font-medium text-ink-secondary mb-1.5">Action</label>
                      <select
                        value={rule.condition_type || 'show'}
                        onChange={(e) => updateSectionConditionRule(sectionIndex, ruleIndex, 'condition_type', e.target.value)}
                        className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-accent-ring focus:border-line-accent outline-none transition-all"
                      >
                        {conditionTypeOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-5 lg:col-span-4">
                      <label className="block text-xs font-medium text-ink-secondary mb-1.5">When Question</label>
                      <select
                        value={rule.when_question}
                        onChange={(e) => updateSectionConditionRule(sectionIndex, ruleIndex, 'when_question', e.target.value)}
                        className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-accent-ring focus:border-line-accent outline-none transition-all"
                      >
                        <option value="">Select question...</option>
                        {previousQuestions.map(q => (
                          <option key={q.name} value={q.name}>
                            {q.label} ({q.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4 lg:col-span-2">
                      <label className="block text-xs font-medium text-ink-secondary mb-1.5">Operator</label>
                      <select
                        value={rule.operator}
                        onChange={(e) => updateSectionConditionRule(sectionIndex, ruleIndex, 'operator', e.target.value)}
                        className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-accent-ring focus:border-line-accent outline-none transition-all"
                      >
                        {operatorOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-10 lg:col-span-3">
                      <label className="block text-xs font-medium text-ink-secondary mb-1.5">Value</label>
                      {(rule.operator === 'in' || rule.operator === 'not_in') ? (
                        <input
                          type="text"
                          value={(rule.values || []).join(', ')}
                          onChange={(e) => updateSectionConditionRule(
                            sectionIndex,
                            ruleIndex,
                            'values',
                            e.target.value.split(',').map(v => v.trim()).filter(v => v)
                          )}
                          placeholder="value1, value2"
                          className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-ring focus:border-line-accent outline-none transition-all"
                        />
                      ) : (rule.operator === 'is_empty' || rule.operator === 'is_not_empty') ? (
                        <input
                          type="text"
                          disabled
                          placeholder="No value needed"
                          className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-subtle text-ink-subtle"
                        />
                      ) : (
                        <input
                          type="text"
                          value={rule.value || ''}
                          onChange={(e) => updateSectionConditionRule(sectionIndex, ruleIndex, 'value', e.target.value)}
                          placeholder="Enter value"
                          className="w-full text-sm border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-ring focus:border-line-accent outline-none transition-all"
                        />
                      )}
                    </div>

                    <div className="sm:col-span-2 lg:col-span-1 flex sm:justify-center sm:pt-6">
                      <button
                        type="button"
                        onClick={() => removeSectionConditionRule(sectionIndex, ruleIndex)}
                        className="inline-flex items-center gap-1.5 p-2 text-ink-subtle hover:text-danger-fg hover:bg-danger-soft rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:hidden text-xs font-medium">Remove rule</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addConditionRuleToSection(sectionIndex)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${colors.light} ${colors.text} hover:opacity-80 transition-all`}
            >
              <Plus className="w-4 h-4" />
              Add Condition Rule
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderQuestionConditionalLogic = (question, sectionIndex, questionIndex) => {
    const previousQuestions = getPreviousQuestions(sectionIndex, questionIndex);
    const colors = getSectionColor(sectionIndex);

    if (!question.conditional_logic) {
      return (
        <div className="mt-4 pt-4 border-t border-line-subtle">
          <button
            type="button"
            onClick={() => toggleQuestionConditionalLogic(sectionIndex, questionIndex)}
            className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink-secondary transition-colors group"
          >
            <GitBranch className="w-4 h-4" />
            <span>Add visibility conditions</span>
          </button>
        </div>
      );
    }

    if (previousQuestions.length === 0) {
      return (
        <div className="mt-4 pt-4 border-t border-line-subtle">
          <Alert variant="warning" className="text-xs mb-2">
            No previous questions available for conditions.
          </Alert>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => toggleQuestionConditionalLogic(sectionIndex, questionIndex)}
            className="text-danger-fg hover:text-danger-fg text-xs"
          >
            Remove Conditions
          </Button>
        </div>
      );
    }

    const isExpanded = expandedConditionalLogic[`question_${sectionIndex}_${questionIndex}`];

    return (
      <div className="mt-4 pt-4 border-t border-line-subtle">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => toggleConditionalExpansion(`question_${sectionIndex}_${questionIndex}`)}
            className="flex items-center gap-2 text-sm font-medium text-ink-secondary hover:text-ink"
          >
            <GitBranch className={`w-4 h-4 ${colors.text}`} />
            <span>Visibility Conditions</span>
            <span className={`${colors.light} ${colors.text} px-2 py-0.5 rounded-full text-xs font-medium`}>
              {question.conditional_logic.rules.length}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-subtle" /> : <ChevronDown className="w-4 h-4 text-ink-subtle" />}
          </button>
          <button
            type="button"
            onClick={() => toggleQuestionConditionalLogic(sectionIndex, questionIndex)}
            className="text-xs text-danger-fg hover:text-danger-fg px-2 py-1 rounded hover:bg-danger-soft transition-all"
          >
            Remove
          </button>
        </div>

        {isExpanded && (
          <div className="bg-subtle rounded-lg p-4 space-y-3 border border-line">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <span className="text-xs font-medium text-ink-secondary">Match:</span>
              <select
                value={question.conditional_logic.logic_type}
                onChange={(e) => updateQuestionLogicType(sectionIndex, questionIndex, e.target.value)}
                className="text-xs border border-line-strong rounded-lg px-2 py-1.5 bg-surface focus:ring-2 focus:ring-accent-ring outline-none"
              >
                <option value="and">All conditions (AND)</option>
                <option value="or">Any condition (OR)</option>
              </select>
            </div>

            {question.conditional_logic.rules.map((rule, ruleIndex) => (
              <div key={ruleIndex} className="bg-surface rounded-lg border border-line p-3 shadow-sm">
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-3 lg:col-span-2">
                    <select
                      value={rule.condition_type || 'show'}
                      onChange={(e) => updateQuestionConditionRule(sectionIndex, questionIndex, ruleIndex, 'condition_type', e.target.value)}
                      className="w-full text-xs border border-line-strong rounded-lg px-2 py-1.5 bg-surface focus:ring-2 focus:ring-accent-ring outline-none"
                    >
                      {conditionTypeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-5 lg:col-span-4">
                    <select
                      value={rule.when_question}
                      onChange={(e) => updateQuestionConditionRule(sectionIndex, questionIndex, ruleIndex, 'when_question', e.target.value)}
                      className="w-full text-xs border border-line-strong rounded-lg px-2 py-1.5 bg-surface focus:ring-2 focus:ring-accent-ring outline-none"
                    >
                      <option value="">Select question...</option>
                      {previousQuestions.map(q => (
                        <option key={q.name} value={q.name}>
                          {q.label} ({q.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4 lg:col-span-2">
                    <select
                      value={rule.operator}
                      onChange={(e) => updateQuestionConditionRule(sectionIndex, questionIndex, ruleIndex, 'operator', e.target.value)}
                      className="w-full text-xs border border-line-strong rounded-lg px-2 py-1.5 bg-surface focus:ring-2 focus:ring-accent-ring outline-none"
                    >
                      {operatorOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-9 lg:col-span-3">
                    {(rule.operator === 'in' || rule.operator === 'not_in') ? (
                      <input
                        type="text"
                        value={(rule.values || []).join(', ')}
                        onChange={(e) => updateQuestionConditionRule(
                          sectionIndex,
                          questionIndex,
                          ruleIndex,
                          'values',
                          e.target.value.split(',').map(v => v.trim()).filter(v => v)
                        )}
                        placeholder="value1, value2"
                        className="w-full text-xs border border-line-strong rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-accent-ring outline-none"
                      />
                    ) : (rule.operator === 'is_empty' || rule.operator === 'is_not_empty') ? (
                      <input
                        type="text"
                        disabled
                        placeholder="No value needed"
                        className="w-full text-xs border border-line rounded-lg px-2 py-1.5 bg-subtle text-ink-subtle"
                      />
                    ) : (
                      <input
                        type="text"
                        value={rule.value || ''}
                        onChange={(e) => updateQuestionConditionRule(sectionIndex, questionIndex, ruleIndex, 'value', e.target.value)}
                        placeholder="Value"
                        className="w-full text-xs border border-line-strong rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-accent-ring outline-none"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-3 lg:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeQuestionConditionRule(sectionIndex, questionIndex, ruleIndex)}
                      className="p-1.5 text-ink-subtle hover:text-danger-fg hover:bg-danger-soft rounded-lg transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addConditionRuleToQuestion(sectionIndex, questionIndex)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink px-2 py-1.5 rounded-lg hover:bg-active transition-all"
            >
              <Plus className="w-3 h-3" />
              Add Rule
            </button>
          </div>
        )}
      </div>
    );
  };

  const validateForm = () => {
    const newErrors = {};
    const fieldNames = new Set();

    if (!formData.name.trim()) {
      newErrors.name = 'Report type name is required';
    }

    if (formData.sections.length === 0) {
      newErrors.sections = 'At least one section is required';
    } else {
      formData.sections.forEach((section, sectionIndex) => {
        if (!section.title.trim()) {
          newErrors[`sections[${sectionIndex}].title`] = 'Section title is required';
        }

        if (section.questions.length === 0) {
          newErrors[`sections[${sectionIndex}].questions`] = 'At least one question is required';
        } else {
          section.questions.forEach((question, questionIndex) => {
            if (!question.label.trim()) {
              newErrors[`sections[${sectionIndex}].questions[${questionIndex}].label`] = 'Question label is required';
            }
            if (!question.name.trim()) {
              newErrors[`sections[${sectionIndex}].questions[${questionIndex}].name`] = 'Field name is required';
            } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(question.name)) {
              newErrors[`sections[${sectionIndex}].questions[${questionIndex}].name`] = 'Field name must start with a letter or underscore and contain only letters, numbers, and underscores';
            } else {
              if (fieldNames.has(question.name)) {
                newErrors[`sections[${sectionIndex}].questions[${questionIndex}].name`] = 'Field name must be unique across all sections';
              } else {
                fieldNames.add(question.name);
              }
            }

            if (['select', 'multiselect'].includes(question.type)) {
              if (!question.options || question.options.length === 0) {
                newErrors[`sections[${sectionIndex}].questions[${questionIndex}].options`] = 'At least one option is required';
              }
            }
          });
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('[data-error="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    onSubmit(formData);
  };

  const renderQuestionForm = (question, sectionIndex, questionIndex) => {
    const typeOption = questionTypeOptions.find(opt => opt.value === question.type);
    const Icon = typeOption?.icon || Type;
    const colors = getSectionColor(sectionIndex);

    const isQuestionExpanded = expandedQuestions[question.id] ?? true;
    const toggleQuestion = () =>
      setExpandedQuestions(prev => ({ ...prev, [question.id]: !(prev[question.id] ?? false) }));

    return (
      <div
        key={question.id}
        className="group bg-surface rounded-xl border border-line shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
      >
        {/* Question Header */}
        <div className="px-5 py-4 border-b border-line-subtle bg-subtle flex items-start justify-between gap-4">
          {/* Clickable identity area — toggles collapse */}
          <button
            type="button"
            onClick={toggleQuestion}
            className="flex items-center gap-3 flex-1 min-w-0 text-left group/hdr"
          >
            <div className={`w-8 h-8 rounded-lg ${colors.light} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${colors.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-sm font-semibold text-ink truncate">
                {question.label || 'Untitled Question'}
              </h5>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-ink-muted">{typeOption?.label || 'Text'}</span>
                {question.required && (
                  <span className="text-xs text-danger-fg font-medium">Required</span>
                )}
                {question.conditional_logic && question.conditional_logic.rules.length > 0 && (
                  <span className={`inline-flex items-center gap-1 text-xs ${colors.text} font-medium`}>
                    <GitBranch className="w-3 h-3" />
                    Conditional
                  </span>
                )}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1">
            {/* Action buttons — shown on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => moveQuestionInSection(sectionIndex, questionIndex, 'up')}
                disabled={questionIndex === 0}
                className="p-1.5 text-ink-subtle hover:text-ink-muted hover:bg-active rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Move up"
              >
                <MoveUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveQuestionInSection(sectionIndex, questionIndex, 'down')}
                disabled={questionIndex === formData.sections[sectionIndex].questions.length - 1}
                className="p-1.5 text-ink-subtle hover:text-ink-muted hover:bg-active rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Move down"
              >
                <MoveDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => duplicateQuestionInSection(sectionIndex, questionIndex)}
                className="p-1.5 text-ink-subtle hover:text-ink-muted hover:bg-active rounded-lg transition-all"
                title="Duplicate"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => removeQuestionFromSection(sectionIndex, questionIndex)}
                className="p-1.5 text-ink-subtle hover:text-danger-fg hover:bg-danger-soft rounded-lg transition-all"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Minimize / Expand — always visible */}
            <button
              type="button"
              onClick={toggleQuestion}
              className={`p-1.5 rounded-lg transition-all ${isQuestionExpanded
                ? 'text-ink-muted hover:text-ink-secondary hover:bg-active'
                : `${colors.text} ${colors.light}`
                }`}
              title={isQuestionExpanded ? 'Minimize question' : 'Expand question'}
            >
              {isQuestionExpanded
                ? <ChevronUp className="w-4 h-4" />
                : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Question Body — collapsible */}
        {isQuestionExpanded && <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2">
              <Input
                label="Question Label"
                value={question.label}
                onChange={(e) => updateQuestionInSection(sectionIndex, questionIndex, 'label', e.target.value)}
                error={errors[`sections[${sectionIndex}].questions[${questionIndex}].label`]}
                required
                data-error={errors[`sections[${sectionIndex}].questions[${questionIndex}].label`] ? "true" : undefined}
              />
            </div>
            <div>

              <label htmlFor="S">Question Type</label>
              <Select
                value={question.type}
                onChange={(e) => updateQuestionInSection(sectionIndex, questionIndex, 'type', e.target.value)}
                options={questionTypeOptions.map(opt => ({
                  value: opt.value,
                  label: opt.label
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink-secondary">
                Field Name <span className="text-ink-subtle font-normal">(auto-generated)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question.name}
                  onChange={(e) => updateFieldName(sectionIndex, questionIndex, e.target.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-accent-ring focus:border-line-accent outline-none transition-all font-mono ${errors[`sections[${sectionIndex}].questions[${questionIndex}].name`]
                    ? 'border-danger-line bg-danger-soft'
                    : 'border-line-strong'
                    }`}
                  placeholder="field_name"
                />
                <button
                  type="button"
                  onClick={() => regenerateFieldName(sectionIndex, questionIndex)}
                  className="px-3 py-2 text-ink-muted hover:text-ink-secondary hover:bg-active rounded-lg border border-line-strong transition-all"
                  title="Regenerate from label"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {errors[`sections[${sectionIndex}].questions[${questionIndex}].name`] && (
                <p className="text-xs text-danger-fg">{errors[`sections[${sectionIndex}].questions[${questionIndex}].name`]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Input
              label="Placeholder Text"
              value={question.placeholder}
              onChange={(e) => updateQuestionInSection(sectionIndex, questionIndex, 'placeholder', e.target.value)}
            />

            <div className="flex items-center h-full pt-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${question.required
                  ? `${colors.accent} border-transparent`
                  : 'border-line-strong group-hover:border-line-strong bg-surface'
                  }`}>
                  {question.required && <CheckSquare className={`w-3.5 h-3.5 ${colors.fg}`} />}
                </div>
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(e) => updateQuestionInSection(sectionIndex, questionIndex, 'required', e.target.checked)}
                  className="hidden"
                />
                <span className="text-sm text-ink-secondary font-medium">Required field</span>
              </label>
            </div>
          </div>

          <Textarea
            label="Help Text"
            value={question.help_text}
            onChange={(e) => updateQuestionInSection(sectionIndex, questionIndex, 'help_text', e.target.value)}
            placeholder="Optional instructions for users"
            rows={2}
          />

          {/* Options for select/multiselect */}
          {['select', 'multiselect'].includes(question.type) && (
            <div className="bg-subtle rounded-lg p-4 border border-line">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-ink">Options</label>
                <span className="text-xs text-ink-muted">{question.options?.length || 0} items</span>
              </div>

              {errors[`sections[${sectionIndex}].questions[${questionIndex}].options`] && (
                <Alert variant="error" className="mb-3 text-xs">
                  {errors[`sections[${sectionIndex}].questions[${questionIndex}].options`]}
                </Alert>
              )}

              <div className="space-y-2 mb-3">
                {question.options?.map((option, optionIndex) => {
                  const normalizedOption = normalizeOption(option);
                  return (
                    <div key={optionIndex} className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-line shadow-sm">

                      <GripVertical className="w-4 h-4 text-ink-subtle" />
                      <input
                        type="text"
                        value={normalizedOption.label}
                        onChange={(e) => updateOptionInQuestion(sectionIndex, questionIndex, optionIndex, 'label', e.target.value)}
                        placeholder="Label"
                        className="flex-1 min-w-0 text-sm border-0 focus:ring-0 p-0"
                      />
                      <div className="w-px h-6 bg-active" />
                      <input
                        type="text"
                        value={normalizedOption.value}
                        onChange={(e) => updateOptionInQuestion(sectionIndex, questionIndex, optionIndex, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 min-w-0 text-sm border-0 focus:ring-0 p-0 font-mono text-ink-muted"
                      />
                      <button
                        type="button"
                        onClick={() => removeOptionFromQuestion(sectionIndex, questionIndex, optionIndex)}
                        className="p-1.5 text-ink-subtle hover:text-danger-fg hover:bg-danger-soft rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => addOptionToQuestion(sectionIndex, questionIndex)}
                className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink px-3 py-2 rounded-lg hover:bg-active transition-all w-full justify-center border border-dashed border-line-strong hover:border-line-strong"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            </div>
          )}

          {/* Validation rules */}
          {['number', 'text', 'textarea'].includes(question.type) && (
            <div className="bg-subtle rounded-lg p-4 border border-line">
              <label className="block text-sm font-semibold text-ink mb-3">
                Validation Rules
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {question.type === 'number' && (
                  <>
                    <Input
                      label="Minimum Value"
                      type="number"
                      value={question.validation?.min || ''}
                      onChange={(e) => updateValidationInQuestion(sectionIndex, questionIndex, 'min', e.target.value)}
                      size="small"
                      maxLength={14}
                    />
                    <Input
                      label="Maximum Value"
                      type="number"
                      value={question.validation?.max || ''}
                      onChange={(e) => updateValidationInQuestion(sectionIndex, questionIndex, 'max', e.target.value)}
                      size="small"
                      maxLength={14}
                    />
                  </>
                )}
                {question.type === 'text' && (
                  <Input
                    label="Minimum Length"
                    type="number"
                    value={question.validation?.minLength || ''}
                    onChange={(e) => updateValidationInQuestion(sectionIndex, questionIndex, 'minLength', e.target.value)}
                    size="small"
                    maxLength={14}
                  />
                )}
                {question.type === 'textarea' && (
                  <Input
                    label="Maximum Length"
                    type="number"
                    value={question.validation?.maxLength || ''}
                    onChange={(e) => updateValidationInQuestion(sectionIndex, questionIndex, 'maxLength', e.target.value)}
                    size="small"
                    maxLength={14}
                  />
                )}
              </div>
            </div>
          )}

          {/* Conditional Logic */}
          {renderQuestionConditionalLogic(question, sectionIndex, questionIndex)}
        </div>}
      </div>
    );
  };

  const renderSectionForm = (section, sectionIndex) => {
    const isExpanded = expandedSections[section.id];
    const colors = getSectionColor(sectionIndex);

    return (
      <div
        key={section.id}
        className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${isExpanded ? `${colors.border} shadow-lg` : 'border-line hover:border-line-strong shadow-sm'
          }`}
      >
        {/* Section Header - Always Visible */}
        <div className={`${isExpanded ? colors.bg : 'bg-surface'} px-4 sm:px-6 py-4 sm:py-5 transition-colors duration-300`}>
          <div className="flex items-start justify-between gap-4">
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex items-center gap-4 flex-1 text-left group"
            >
              <div className={`w-12 h-12 rounded-xl ${colors.accent} ${colors.fg} flex items-center justify-center text-lg font-bold shadow-lg shrink-0`}>
                {sectionIndex + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-ink truncate">
                    {section.title || `Section ${sectionIndex + 1}`}
                  </h3>
                  {section.conditional_logic && section.conditional_logic.rules.length > 0 && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.light} ${colors.text}`}>
                      <GitBranch className="w-3 h-3" />
                      Conditional
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-muted mt-1 line-clamp-1">
                  {section.description || `${section.questions.length} question${section.questions.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              <div className={`p-2 rounded-lg transition-all ${isExpanded ? 'bg-subtle rotate-180' : 'bg-active group-hover:bg-active'}`}>
                <ChevronDown className="w-5 h-5 text-ink-muted" />
              </div>
            </button>

            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() => moveSection(sectionIndex, 'up')}
                disabled={sectionIndex === 0}
                className="p-2 text-ink-subtle hover:text-ink-muted hover:bg-subtle rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Move up"
              >
                <MoveUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveSection(sectionIndex, 'down')}
                disabled={sectionIndex === formData.sections.length - 1}
                className="p-2 text-ink-subtle hover:text-ink-muted hover:bg-subtle rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Move down"
              >
                <MoveDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => removeSection(sectionIndex)}
                className="p-2 text-ink-subtle hover:text-danger-fg hover:bg-danger-soft rounded-lg transition-all"
                title="Delete section"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Section Content - Expandable */}
        {isExpanded && (
          <div className="bg-surface px-4 sm:px-6 py-4 sm:py-6 border-t border-line-subtle">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
              <div className="lg:col-span-2">
                <Input
                  label="Section Title"
                  value={section.title}
                  onChange={(e) => updateSection(sectionIndex, 'title', e.target.value)}
                  error={errors[`sections[${sectionIndex}].title`]}
                  required
                  data-error={errors[`sections[${sectionIndex}].title`] ? "true" : undefined}
                />
              </div>

              <div className="lg:col-span-2">
                <Textarea
                  label="Section Description"
                  value={section.description}
                  onChange={(e) => updateSection(sectionIndex, 'description', e.target.value)}
                  placeholder="Describe what this section is about (optional)"
                  rows={2}
                />
              </div>
            </div>

            {/* Section Conditional Logic */}
            {renderSectionConditionalLogic(section, sectionIndex)}

            {/* Questions Container */}
            <div className={`mt-6 rounded-xl border-2 border-dashed ${colors.border} ${colors.bg} p-3 sm:p-6`}>
              <div className="flex items-center justify-between mb-5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedQuestionsPanels(prev => ({
                      ...prev,
                      [section.id]: !(prev[section.id] ?? true)
                    }))
                  }
                  className="flex items-center gap-3 flex-1 text-left group/qp"
                >
                  <Layers className={`w-5 h-5 ${colors.text}`} />
                  <h4 className="font-semibold text-ink">
                    Questions{' '}
                    <span className="text-ink-muted font-normal">({section.questions.length})</span>
                  </h4>
                  <div className={`p-1 rounded-lg transition-all ml-1 ${(expandedQuestionsPanels[section.id] ?? true)
                    ? 'text-ink-subtle group-hover/qp:text-ink-muted group-hover/qp:bg-subtle'
                    : `${colors.text} ${colors.light}`
                    }`}>
                    {(expandedQuestionsPanels[section.id] ?? true)
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => addQuestionToSection(sectionIndex)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${colors.fg} ${colors.accent} hover:opacity-90 shadow-sm hover:shadow transition-all`}
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </button>
              </div>

              {errors[`sections[${sectionIndex}].questions`] && (
                <Alert variant="error" className="mb-4">
                  {errors[`sections[${sectionIndex}].questions`]}
                </Alert>
              )}

              {(expandedQuestionsPanels[section.id] ?? true) && (
                section.questions.length === 0 ? (
                  <div className="text-center py-10 bg-subtle rounded-xl border border-line">
                    <div className="w-16 h-16 rounded-full bg-active flex items-center justify-center mx-auto mb-4">
                      <HelpCircle className="w-8 h-8 text-ink-subtle" />
                    </div>
                    <h5 className="text-base font-semibold text-ink mb-2">No questions yet</h5>
                    <p className="text-sm text-ink-muted mb-4 max-w-sm mx-auto">
                      Add questions to collect information from users in this section
                    </p>
                    <button
                      type="button"
                      onClick={() => addQuestionToSection(sectionIndex)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${colors.light} ${colors.text} hover:opacity-80 transition-all`}
                    >
                      <Plus className="w-4 h-4" />
                      Add First Question
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {section.questions.map((question, questionIndex) =>
                      renderQuestionForm(question, sectionIndex, questionIndex)
                    )}

                    {/* Mirrors the bottom "Add Another Section" button, so a
                        long list of questions does not send you back up to the
                        panel header to add one. */}
                    <button
                      type="button"
                      onClick={() => addQuestionToSection(sectionIndex)}
                      className="w-full py-3 border-2 border-dashed border-line-strong rounded-xl text-ink-muted hover:text-ink-secondary hover:border-line-strong hover:bg-subtle transition-all flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Question
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPreview = () => {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-surface rounded-2xl shadow-xl border border-line overflow-hidden">
          {/* Preview Header */}
          <div className="bg-sunken px-4 sm:px-8 py-4 sm:py-6 text-ink">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{formData.name || 'Untitled Report'}</h3>
                {formData.description && (
                  <p className="text-ink-subtle mt-1 text-sm">{formData.description}</p>
                )}
              </div>
              {readOnly ? (
                onEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-on-accent hover:bg-accent-hover rounded-lg text-sm font-medium transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    Edit
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-subtle hover:bg-subtle rounded-lg text-sm font-medium transition-all"
                >
                  <Settings className="w-4 h-4" />
                  Edit Form
                </button>
              )}
            </div>
          </div>

          {/* Preview Content */}
          <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
            {formData.sections.map((section, sectionIndex) => (
              <div key={section.id} className="relative">
                {sectionIndex > 0 && <div className="absolute -top-4 left-0 right-0 h-px bg-active" />}

                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 rounded-full bg-active text-ink-muted flex items-center justify-center text-sm font-bold">
                      {sectionIndex + 1}
                    </span>
                    <h4 className="text-lg font-bold text-ink">{section.title}</h4>
                    {section.conditional_logic && section.conditional_logic.rules.length > 0 && (
                      <span className="bg-warning-soft text-warning-fg px-2 py-1 rounded-full text-xs font-medium">
                        Conditional
                      </span>
                    )}
                  </div>
                  {section.description && (
                    <p className="text-sm text-ink-muted ml-11">{section.description}</p>
                  )}
                </div>

                <div className="space-y-5 ml-11">
                  {section.questions.map((question) => {
                    const normalizedType = normalizeQuestionType(question.type);
                    return (
                      <div key={question.id} className="space-y-2">
                        <div className="flex items-start justify-between">
                          <label className="block text-sm font-medium text-ink">
                            {question.label}
                            {question.required && <span className="text-danger-fg ml-1">*</span>}
                          </label>
                          {question.conditional_logic && question.conditional_logic.rules.length > 0 && (
                            <span className="bg-accent-soft text-accent-fg px-2 py-0.5 rounded text-xs font-medium">
                              Conditional
                            </span>
                          )}
                        </div>

                        {question.help_text && (
                          <p className="text-xs text-ink-muted">{question.help_text}</p>
                        )}

                        {normalizedType === 'text' && (
                          <input
                            type="text"
                            className="w-full border border-line-strong rounded-lg px-4 py-2.5 text-sm bg-subtle"
                            // placeholder={question.placeholder}
                            disabled
                          />
                        )}

                        {normalizedType === 'textarea' && (
                          <textarea
                            className="w-full border border-line-strong rounded-lg px-4 py-2.5 text-sm bg-subtle"
                            placeholder={question.placeholder}
                            rows={3}
                            disabled
                          />
                        )}

                        {normalizedType === 'select' && (
                          <select
                            className="w-full border border-line-strong rounded-lg px-4 py-2.5 text-sm bg-subtle"
                            disabled
                          >
                            <option value="">{question.placeholder || 'Select an option'}</option>
                            {question.options?.map((option, i) => (
                              <option key={i} value={normalizeOption(option).value}>{normalizeOption(option).label}</option>
                            ))}
                          </select>
                        )}

                        {normalizedType === 'multiselect' && (
                          <div className="space-y-2 bg-subtle p-3 rounded-lg border border-line">
                            {question.options?.map((option, i) => (
                              <label key={i} className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded border border-line-strong bg-surface" />
                                <span className="text-sm text-ink-secondary">{normalizeOption(option).label}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {normalizedType === 'boolean' && (
                          <div className="flex gap-6">
                            <label className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full border border-line-strong bg-surface" />
                              <span className="text-sm text-ink-secondary">Yes</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full border border-line-strong bg-surface" />
                              <span className="text-sm text-ink-secondary">No</span>
                            </label>
                          </div>
                        )}

                        {normalizedType === 'number' && (
                          <input
                            type="number"
                            className="w-full border border-line-strong rounded-lg px-4 py-2.5 text-sm bg-subtle"
                            placeholder={question.placeholder}
                            maxLength={14}
                            onInput={(e) => {
                              if (e.target.value.replace(/[^0-9]/g, '').length > 14) {
                                e.target.value = e.target.value.slice(0, 14);
                              }
                            }}
                            disabled
                          />
                        )}

                        {normalizedType === 'email' && (
                          <input
                            type="email"
                            className="w-full border border-line-strong rounded-lg px-4 py-2.5 text-sm bg-subtle"
                            placeholder={question.placeholder || 'email@example.com'}
                            disabled
                          />
                        )}

                        {normalizedType === 'date' && (
                          <input
                            type="date"
                            className="w-full border border-line-strong rounded-lg px-4 py-2.5 text-sm bg-subtle"
                            max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]}
                            disabled
                          />
                        )}

                        {(normalizedType === 'datetime' || normalizedType === 'datetime-local') && (
                          <input
                            type="datetime-local"
                            className="w-full border border-line-strong rounded-lg px-4 py-2.5 text-sm bg-subtle"
                            max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                            disabled
                          />
                        )}

                        {normalizedType === 'file' && (
                          <div className="border-2 border-dashed border-line-strong rounded-lg p-6 text-center bg-subtle">
                            <Upload className="w-8 h-8 text-ink-subtle mx-auto mb-2" />
                            <p className="text-sm text-ink-muted">Click to upload or drag and drop</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {formData.sections.length === 0 && (
              <div className="text-center py-12 text-ink-muted">
                <LayoutTemplate className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No sections added yet</p>
              </div>
            )}
          </div>

          {/* Preview Footer */}
          <div className="bg-subtle px-4 sm:px-8 py-4 border-t border-line flex justify-end gap-3">
            <button className="px-4 py-2 text-ink-secondary font-medium hover:bg-active rounded-lg transition-all" disabled>
              Cancel
            </button>
            <button className="px-6 py-2 bg-sunken text-ink font-medium rounded-lg opacity-50 cursor-not-allowed">
              Submit Report
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-subtle pb-20">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-surface border-b border-line shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 h-auto py-2 sm:h-16 sm:py-0 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent flex items-center justify-center shadow-glow shrink-0">
                <FileText className="w-5 h-5 text-on-accent" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-ink truncate">
                  {readOnly ? 'View Report Type' : initialData ? 'Edit Report Type' : 'New Report Type'}
                </h1>
                <p className="text-xs text-ink-muted hidden sm:block">
                  {formData.name || 'Untitled'} • {formData.sections.length} section{formData.sections.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {readOnly ? (
                /* View mode: nothing to switch between and nothing to save —
                   just a way back to the list and a way into the editor. */
                <>
                  <button
                    type="button"
                    onClick={onBack || (() => window.history.back())}
                    className="px-3 sm:px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-active rounded-lg transition-all"
                  >
                    Back
                  </button>
                  {onEdit && (
                    <button
                      type="button"
                      onClick={onEdit}
                      className="flex items-center gap-2 px-3 sm:px-5 py-2 bg-accent text-on-accent text-sm font-medium rounded-lg shadow-md hover:bg-accent-hover hover:shadow-lg transition-all whitespace-nowrap"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit Report Type</span>
                      <span className="sm:hidden">Edit</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="flex bg-active rounded-lg p-1" data-tour="rtb-mode-toggle">
                    <button
                      type="button"
                      onClick={() => setPreviewMode(false)}
                      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!previewMode ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                        }`}
                    >
                      <LayoutTemplate className="w-4 h-4" />
                      <span className="hidden sm:inline">Builder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode(true)}
                      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-all ${previewMode ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                        }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>
                  </div>

                  <div className="h-6 w-px bg-active hidden sm:block" />

                  <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="px-3 sm:px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-active rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 sm:px-5 py-2 bg-sunken hover:bg-raised text-ink text-sm font-medium rounded-lg shadow-md hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    data-tour="rtb-submit"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{initialData ? 'Save Changes' : 'Save Report Type'}</span>
                    <span className="sm:hidden">{initialData ? 'Save' : 'Save'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {previewMode ? (
          renderPreview()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Settings */}
            <div className="lg:col-span-4 xl:col-span-3 space-y-6">
              <div className="bg-surface rounded-xl shadow-sm border border-line p-6 sticky top-24" data-tour="rtb-basic-settings">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="w-5 h-5 text-warning-fg" />
                  <h3 className="font-bold text-ink">Basic Settings</h3>
                </div>

                <div className="space-y-5">
                  <Input
                    label="Report Type Name"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    error={errors.name}
                    required
                    data-error={errors.name ? "true" : undefined}
                  />

                  <Textarea
                    label="Description"
                    value={formData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="What is this report type used for?"
                    rows={3}
                  />

                  <div className="pt-4 border-t border-line-subtle">
                    <label className="flex items-center justify-between cursor-pointer group p-3 rounded-lg hover:bg-subtle transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${formData.is_active ? 'bg-success-soft text-success-fg' : 'bg-active text-ink-subtle'
                          }`}>
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="block text-sm font-semibold text-ink">Active Status</span>
                          <span className="block text-xs text-ink-muted">
                            {formData.is_active ? 'Visible to users' : 'Hidden from users'}
                          </span>
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full transition-all relative ${formData.is_active ? 'bg-success-solid' : 'bg-active'
                        }`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-surface shadow-sm transition-all ${formData.is_active ? 'left-6' : 'left-1'
                          }`} />
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => handleFieldChange('is_active', e.target.checked)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="pt-4 border-t border-line-subtle">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-muted">Auto-generate field names</span>
                      <button
                        type="button"
                        onClick={() => setAutoGenerateFieldName(!autoGenerateFieldName)}
                        className={`w-11 h-6 rounded-full transition-all relative ${autoGenerateFieldName ? 'bg-accent' : 'bg-active'
                          }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-surface shadow-sm transition-all ${autoGenerateFieldName ? 'left-6' : 'left-1'
                          }`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              {/* <div className="bg-accent rounded-xl shadow-lg p-6 text-on-accent">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Form Statistics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-subtle rounded-lg p-3">
                    <div className="text-2xl font-bold">{formData.sections.length}</div>
                    <div className="text-xs text-accent-fg">Sections</div>
                  </div>
                  <div className="bg-subtle rounded-lg p-3">
                    <div className="text-2xl font-bold">
                      {formData.sections.reduce((acc, s) => acc + s.questions.length, 0)}
                    </div>
                    <div className="text-xs text-accent-fg">Questions</div>
                  </div>
                </div>
              </div> */}
            </div>

            {/* Main Content - Sections */}
            <div className="lg:col-span-8 xl:col-span-9" data-tour="rtb-sections">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-ink">Form Sections</h2>
                  <p className="text-sm text-ink-muted">Organize your form into logical steps</p>
                </div>
                <button
                  type="button"
                  onClick={addSection}
                  className="flex items-center gap-2 px-4 py-2.5 bg-sunken hover:bg-raised text-ink text-sm font-medium rounded-lg shadow-md hover:shadow-xl transition-all"
                  data-tour="rtb-add-section"
                >
                  <Plus className="w-4 h-4" />
                  Add Section
                </button>
              </div>

              {errors.sections && (
                <Alert variant="error" className="mb-6">
                  {errors.sections}
                </Alert>
              )}

              {formData.sections.length === 0 ? (
                <div className="bg-surface rounded-2xl border-2 border-dashed border-line-strong p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-active flex items-center justify-center mx-auto mb-6">
                    <LayoutTemplate className="w-10 h-10 text-ink-subtle" />
                  </div>
                  <h3 className="text-xl font-bold text-ink mb-3">Start building your form</h3>
                  <p className="text-ink-muted mb-8 max-w-md mx-auto">
                    Create sections to organize your report into logical steps. Each section can contain multiple questions and conditional logic.
                  </p>
                  <button
                    type="button"
                    onClick={addSection}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-sunken text-ink font-medium rounded-xl shadow-md hover:bg-sunken transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Create First Section
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {formData.sections.map((section, index) => (
                    renderSectionForm(section, index)
                  ))}

                  {/* Add Section Button at Bottom */}
                  <button
                    type="button"
                    onClick={addSection}
                    className="w-full py-4 border-2 border-dashed border-line-strong rounded-2xl text-ink-muted hover:text-ink-secondary hover:border-line-strong hover:bg-subtle transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Add Another Section
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportTypeBuilder;
