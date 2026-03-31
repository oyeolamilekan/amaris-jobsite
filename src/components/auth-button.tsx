import { Link } from '@tanstack/react-router'
import { authClient } from '~/lib/auth-client'
import { LogIn, LogOut, User } from 'lucide-react'
import { Button } from '~/components/ui/button'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export function AuthButton() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <Button variant="ghost" size="icon" disabled className="size-9">
        <User />
      </Button>
    )
  }

  if (!session) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link to="/sign-in">
          <LogIn data-icon="inline-start" />
          Sign in
        </Link>
      </Button>
    )
  }

  const initials = session.user.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 rounded-full">
          <Avatar className="size-8">
            <AvatarImage src={session.user.image ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{session.user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {session.user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
