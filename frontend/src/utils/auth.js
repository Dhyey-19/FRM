export const getLoggedUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  } catch {
    return {};
  }
};

export const hasAddPermission = () => {
  const user = getLoggedUser();
  const role = String(user.UserRole || user.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'ADMINISTRATOR') return true;
  return user.IsAdd === true || user.IsAdd === 1;
};

export const hasEditPermission = () => {
  const user = getLoggedUser();
  const role = String(user.UserRole || user.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'ADMINISTRATOR') return true;
  return user.IsEdit === true || user.IsEdit === 1;
};

export const hasDeletePermission = () => {
  const user = getLoggedUser();
  const role = String(user.UserRole || user.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'ADMINISTRATOR') return true;
  return user.IsDelete === true || user.IsDelete === 1;
};

export const hasMenuAccess = (path) => {
  const user = getLoggedUser();
  const role = String(user.UserRole || user.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'ADMINISTRATOR') return true;
  if (!path || path === '/dashboard') return true;
  
  const menus = user.AllowedMenus;
  if (!menus) return false;
  
  const allowed = Array.isArray(menus)
    ? menus
    : String(menus).split(',').map(p => p.trim());
    
  return allowed.includes(path);
};

