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
  
  const cleanPath = path.split('?')[0];
  const menus = user.AllowedMenus;
  if (!menus) return false;
  
  const allowed = Array.isArray(menus)
    ? menus
    : String(menus).split(',').map(p => p.trim());
    
  if (cleanPath === '/dashboard/subcontract') {
    return allowed.includes('/dashboard/subcontract') || 
           allowed.includes('/dashboard/jobwork-ins') || 
           allowed.includes('/dashboard/jobwork-outs');
  }

  if (cleanPath === '/dashboard/jobwork-ins' || cleanPath === '/dashboard/jobwork-outs') {
    return allowed.includes(cleanPath) || allowed.includes('/dashboard/subcontract');
  }

  return allowed.includes(path) || allowed.includes(cleanPath);
};

