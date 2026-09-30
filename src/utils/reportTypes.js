/**
 * Reshapes a report type as the API returns it into the shape
 * `ReportTypeBuilder` expects.
 *
 * The API can hand back either `_id` or `id` for nested records, and returns
 * select/radio options as plain strings, while the builder works in
 * `{ value, label }` pairs. Both the edit page and the view page render through
 * the builder, so they share this rather than keeping two copies that can
 * drift.
 */
export const toBuilderShape = (reportType) => {
  if (!reportType) return null;

  return {
    ...reportType,
    sections: reportType.sections?.map((section, sectionIndex) => ({
      id: section._id || section.id || `section_${sectionIndex}`,
      title: section.title,
      description: section.description,
      order: section.order || 0,
      conditional_logic: section.conditional_logic || null,
      questions: section.questions?.map((question, questionIndex) => ({
        id: question._id || question.id || `question_${sectionIndex}_${questionIndex}`,
        type: question.type,
        label: question.label,
        name: question.name,
        required: question.required,
        placeholder: question.placeholder,
        help_text: question.help_text,
        default_value: question.default_value,
        validation: question.validation || {},
        order: question.order || 0,
        conditional_logic: question.conditional_logic || null,
        options: question.options?.map((opt) => {
          if (typeof opt === 'string') {
            return { value: opt, label: opt };
          }
          return {
            value: opt?.value ?? opt?.label ?? '',
            label: opt?.label ?? opt?.value ?? '',
          };
        }) || [],
      })) || [],
    })) || [],
  };
};

/** Section, question, and required-question counts for a report type. */
export const summarizeReportType = (reportType) => {
  const sections = reportType?.sections || [];
  return {
    sections: sections.length,
    questions: sections.reduce((total, s) => total + (s.questions?.length || 0), 0),
    required: sections.reduce(
      (total, s) => total + (s.questions?.filter((q) => q.required)?.length || 0),
      0,
    ),
  };
};
