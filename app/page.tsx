import { redirect } from 'next/navigation';

// Главная страница — перенаправляем на профиль (основной экран мини-приложения)
export default function RootPage() {
  redirect('/profile');
}
