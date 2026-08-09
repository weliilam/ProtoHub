import React from 'react';

export interface ClientShellProps {
  /** 窗体标题（可选，预留状态栏展示） */
  title?: string;
  children?: React.ReactNode;
}

/**
 * ClientShell —— WinForms 窗体根容器（灰底，模拟 Form）。
 * 使用时外层需带 .client-theme 类名（client.css 作用域）。
 */
const ClientShell: React.FC<ClientShellProps> = ({ title, children }) => {
  return (
    <div className="client-form" data-title={title}>
      {children}
    </div>
  );
};

export default ClientShell;
