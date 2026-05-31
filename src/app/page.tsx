import { redirect } from 'next/navigation'

export default function HomePage() {
  // Instantly redirect anyone who visits the root URL to the secure login page
  redirect('/login')
}