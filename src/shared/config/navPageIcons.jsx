import React from 'react';
import {
  FiBarChart2,
  FiUsers,
  FiPackage,
  FiBookOpen,
  FiSettings,
  FiTrendingUp,
  FiClock,
  FiCalendar,
  FiClipboard,
  FiTruck,
  FiLogOut,
  FiUser,
  FiChevronLeft,
  FiMenu,
  FiX,
  FiLayers,
  FiBriefcase,
} from 'react-icons/fi';
import { MdOutlineScience, MdOutlineWarehouse } from 'react-icons/md';
import { HiOutlineClipboardDocumentCheck } from 'react-icons/hi2';

const stroke18 = { size: 18, strokeWidth: 2, 'aria-hidden': true };
const asNav = (Icon, extra = {}) => (props) => <Icon {...stroke18} {...extra} {...props} />;

/** Общие иконки навигации (react-icons), 18px в сайдбаре. */
export const NavIcons = {
  BarChart2: asNav(FiBarChart2),
  Users: asNav(FiUsers),
  Factory: asNav(FiLayers),
  Package: asNav(FiPackage),
  Flask: (props) => <MdOutlineScience size={18} aria-hidden {...props} />,
  BookOpen: asNav(FiBookOpen),
  Cog: asNav(FiSettings),
  Warehouse: (props) => <MdOutlineWarehouse size={18} aria-hidden {...props} />,
  Building2: asNav(FiBriefcase),
  TrendingUp: asNav(FiTrendingUp),
  Clock: asNav(FiClock),
  CalendarCheck: asNav(FiCalendar),
  ClipboardCheck: asNav(HiOutlineClipboardDocumentCheck),
  ClipboardList: asNav(FiClipboard),
  Truck: asNav(FiTruck),
  LogOut: asNav(FiLogOut),
  User: asNav(FiUser),
  ChevronLeft: (props) => <FiChevronLeft size={16} strokeWidth={2.5} aria-hidden {...props} />,
  Menu: (props) => <FiMenu size={20} strokeWidth={2} aria-hidden {...props} />,
  X: (props) => <FiX size={20} strokeWidth={2} aria-hidden {...props} />,
};

/** Иконка пункта меню по ключу доступа. */
export const ACCESS_NAV_ICONS = {
  my_shift: NavIcons.Clock,
  analytics: NavIcons.BarChart2,
  clients: NavIcons.Building2,
  sales: NavIcons.TrendingUp,
  client_orders: NavIcons.ClipboardList,
  payments: NavIcons.TrendingUp,
  returns: NavIcons.Truck,
  defects: NavIcons.ClipboardCheck,
  lines: NavIcons.Factory,
  materials: NavIcons.Package,
  chemistry: NavIcons.Flask,
  recipes: NavIcons.BookOpen,
  otk: NavIcons.ClipboardCheck,
  warehouse: NavIcons.Warehouse,
  users: NavIcons.Users,
  shifts: NavIcons.CalendarCheck,
  production: NavIcons.Factory,
  orders: NavIcons.ClipboardList,
  shipments: NavIcons.Truck,
};
