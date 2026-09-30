import { useNavigate } from "react-router-dom";

const useNavigation = ({ navigateLink, orgSlug }) => {
    const navigate = useNavigate();

    if (!orgSlug || orgSlug === 'undefined') {
      navigate(`/${navigateLink}`);
    } else {
      navigate(`/${orgSlug}/${navigateLink}`);
    }
  return null;
};

export default useNavigation;