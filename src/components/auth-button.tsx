import { Link } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { Button } from '~/components/ui/button'

export function AuthButton() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link search={{ redirect: undefined }} to="/sign-in">
        <LogIn data-icon="inline-start" />
        Sign in
      </Link>
    </Button>
  )
}
