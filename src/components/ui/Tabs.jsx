// src/components/ui/Tabs.jsx
import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext({});

const Tabs = ({
  children,
  defaultValue,
  value: controlledValue,
  onChange,
  className = '',
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = (newValue) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <TabsContext.Provider value={{ value, onChange: handleChange }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsList = ({ children, className = '', ...props }) => {
  const context = useContext(TabsContext);

  return (
    // Scrolls horizontally rather than wrapping, so a long tab set stays on
    // one line on narrow screens.
    <div
      className={`flex items-center gap-1 border-b border-line overflow-x-auto overflow-y-hidden scrollbar-none ${className}`}
      role="tablist"
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { context });
        }
        return child;
      })}
    </div>
  );
};

const TabsTrigger = ({
  children,
  value,
  className = '',
  context: externalContext,
  ...props
}) => {
  const context = useContext(TabsContext);
  const { value: activeValue, onChange } = externalContext || context;

  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={`relative shrink-0 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-md transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus ${
        isActive
          ? 'text-accent-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent'
          : 'text-ink-muted hover:text-ink hover:bg-hover'
      } ${className}`}
      onClick={() => onChange(value)}
      {...props}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ children, value, className = '', ...props }) => {
  const { value: activeValue } = useContext(TabsContext);

  if (value !== activeValue) return null;

  // Only fall back to the default gap when the caller hasn't set its own top
  // margin — otherwise the two classes collide and Tailwind's own ordering,
  // not the source order, decides the winner.
  const hasTopMargin = /(^|\s)mt-/.test(className);

  return (
    <div
      role="tabpanel"
      className={`${hasTopMargin ? '' : 'mt-4'} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export default Tabs;
