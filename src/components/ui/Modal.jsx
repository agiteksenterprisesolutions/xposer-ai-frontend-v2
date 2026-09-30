// src/components/ui/Modal.jsx
//
// The app grew two modal implementations at different import paths. This one
// now delegates to the canonical modal in ../layout/Modal so they can't drift
// apart again — it only adapts the size names this copy's callers already use.
import BaseModal, { ConfirmationModal as BaseConfirmationModal } from '../layout/Modal';

const SIZE_ALIASES = {
  small: 'sm',
  xlarge: 'xl',
};

const Modal = ({ size = 'medium', ...props }) => (
  <BaseModal size={SIZE_ALIASES[size] || size} {...props} />
);

export const ConfirmationModal = (props) => <BaseConfirmationModal {...props} />;

export { FullscreenModal } from '../layout/Modal';
export default Modal;
