import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ListTodo, MessageSquare, FileText, DollarSign, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const primaryItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/fila', label: 'Fila', icon: ListTodo },
  { path: '/mensagens', label: 'Mensagens', icon: MessageSquare },
];

const moreItems = [
  { path: '/contratos', label: 'Contratos', icon: FileText },
  { path: '/financeiro', label: 'Contas', icon: DollarSign },
];

const MobileBottomNav = () => {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = moreItems.some(i => i.path === location.pathname);

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-[59] bg-foreground/20 backdrop-blur-sm md:hidden" onClick={() => setShowMore(false)} />
      )}

      {/* More menu popup */}
      {showMore && (
        <div className="fixed bottom-[4.5rem] left-1/2 -translate-x-1/2 z-[60] bg-card border border-border rounded-xl shadow-2xl p-2 flex gap-2 md:hidden">
          {moreItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setShowMore(false)}
                className={cn(
                  'flex flex-col items-center gap-1 px-5 py-2.5 rounded-lg transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 inset-x-0 z-[58] bg-card border-t border-border md:hidden safe-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {primaryItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[3.5rem] transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[3.5rem] transition-colors',
              isMoreActive || showMore ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <MoreHorizontal className={cn("h-5 w-5", (isMoreActive || showMore) && "stroke-[2.5]")} />
            <span className={cn("text-[10px]", isMoreActive || showMore ? "font-bold" : "font-medium")}>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
