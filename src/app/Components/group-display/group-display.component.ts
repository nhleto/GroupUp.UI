import { Component, OnInit, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Observable,
  shareReplay,
  tap,
  mergeMap,
  forkJoin,
  combineLatest,
  of,
  map,
  filter,
  take,
  from,
  toArray,
  BehaviorSubject,
} from 'rxjs';
import { Group } from '../../Models/group';
import { Utility } from 'src/app/Utils/utility';
import { DataProviderService } from 'src/app/Services/data-provider.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { User } from 'src/app/Models/user';
import { UserService } from 'src/app/Services/user.service';

@Component({
  selector: 'app-group-display',
  templateUrl: './group-display.component.html',
  styleUrls: ['./group-display.component.scss'],
})
export class GroupDisplayComponent extends Utility implements OnInit {
  group$: Observable<Group>;
  private usersSub = new BehaviorSubject<User[]>(null);
  users$ = this.usersSub.asObservable();
  // ViewModel
  vm$: Observable<{ includes: boolean; user: User }>;

  constructor(
    private activatedRoute: ActivatedRoute,
    private dataProviderService: DataProviderService,
    protected override angularFireAuth: AngularFireAuth,
    protected override router: Router,
    private userService: UserService
  ) {
    super(router, angularFireAuth);
  }

  ngOnInit(): void {
    // TODO: Refactor to use streams
    const groupId = this.activatedRoute.snapshot.params['id'];

    this.group$ = this.dataProviderService
      .getGroup(groupId)
      .pipe(shareReplay(1));

    // TODO: Refactor to use vm for entire template
    this.vm$ = combineLatest([this.userService.user$, this.users$]).pipe(
      filter(([user]) => !!user),
      map(([user, users]) => {
        return { includes: !!users.find((u) => u.id === user.id), user };
      })
    );

    combineLatest([this.userService.user$, this.group$])
      .pipe(
        filter(([user, _]) => !!user),
        mergeMap(([user, { userIds }]) =>
          this.checkIfShouldGetUser(user, userIds)
        ),
        map(users => users.sort((a, b) => a.displayName.localeCompare(b.displayName)))
      )
      .subscribe(this.usersSub);
  }

  shouldShowPartnerButton$(displayUser: User): Observable<boolean> {
    return combineLatest([this.userService.user$, this.group$, this.users$]).pipe(
      map(
        ([user, group, users]) =>
          !!user
          && user.id === displayUser.id
          && this.doUsersHavePartners(user, users, group)
          && (!user.partners || !user.partners.find((p) => p.groupId === group.id))
      ),
      shareReplay(1)
    );
  }

  joinGroup() {
    forkJoin([this.addUserToUsers(), this.updateUserAndGroup()])
      .pipe(take(1))
      .subscribe();
  }

  // TODO: Make this readable
  findPartner() {
    combineLatest([this.userService.user$, this.group$, this.users$]).pipe(
      take(1),
      map(([user, group, users]) => {
        const otherUsers = users.filter((u) => u.id !== user.id);
        const eligiblePartners = otherUsers.filter((user) => !user.partners 
        || user.partners.every((partner) => partner.groupId !== group.id && partner.userId !== user.id));
        
        if (eligiblePartners.length === 0) {
          throw new Error('No eligible partners');
        }

        // set partner on both users
        const partner = eligiblePartners[Math.floor(Math.random() * eligiblePartners.length)];
        const partnerUser = { ...partner, partners: [...partner.partners, { groupId: group.id, userId: user.id }] };
        const userWithPartner = { ...user, partners: [...user.partners, { groupId: group.id, userId: partner.id }] };
        return { userWithPartner, partnerUser, users };
      }),
      mergeMap(({userWithPartner, partnerUser, users}) => forkJoin([
        this.dataProviderService.updateUser(userWithPartner),
        this.dataProviderService.updateUser(partnerUser),
        of({users: [...users, userWithPartner, partnerUser], partner: partnerUser, newUser: userWithPartner})
      ])),
    ).subscribe({
      next: ([, , updatedUsers]) => {
        const {users, partner, newUser} = updatedUsers;
        // find and replace the users in the users array with the user and also the user with the partner
        console.log(users);
        const updatedUsersArray = users.reduce((acc, user) => {
          if (user.id === newUser.id) {
            acc.push(newUser);
            return acc;
          }

          if (user.id === partner.id) {
            acc.push(partner);
            return acc;
          }
          
          acc.push(user);
          return acc;
        }, []);

        console.log(updatedUsersArray)
        this.userService.setUser = newUser;
        this.usersSub.next(updatedUsersArray);
      }
    });
  }

  private updateUserAndGroup() {
    return combineLatest([this.userService.user$, this.group$]).pipe(
      map(([user, group]) => this.newUserGroup(user, group)),
      mergeMap(({ user, group }) =>
        forkJoin([
          this.dataProviderService.updateUser(user),
          this.dataProviderService.updateGroup(group),
        ])
      )
    );
  }

  private addUserToUsers() {
    return combineLatest([this.userService.user$, this.users$]).pipe(
      map(([user, users]) => [...users, user]),
      take(1),
      // Moving the take below this tap causes infinte loop. has to be a better way to do this...
      tap((users) => this.usersSub.next(users))
    );
  }

  private newUserGroup(user: User, group: Group): { user: User; group: Group } {
    const dedupedGroups = [...new Set([...user.groups, group.id])];
    const dedupedUserIds = [...new Set([...group.userIds, user.id])];

    return {
      user: { ...user, groups: dedupedGroups },
      group: { ...group, userIds: dedupedUserIds },
    };
  }

  private checkIfShouldGetUser(
    user: User,
    userIds: string[]
  ): Observable<User[]> {
    // TODO: Optimize this to not fetch current user
    return of(userIds.filter((id) => id !== user.id)).pipe(
      mergeMap((ids) =>
        ids.length > 0
          ? from(userIds).pipe(
              mergeMap((id) => this.userService.getUser(id)),
              toArray()
            )
          : of([user])
      )
    );
  }

  private doUsersHavePartners(user: User, users: User[], group: Group): boolean {
    const otherUsers = users.filter((u) => u.id !== user.id);
    // Check the number of other users in the group that have partners in this group, if it's even, then we can show the button
    return otherUsers.filter((user) => user.partners && user.partners.find((p) => p.groupId === group.id)).length % 2 === 0;
  }
}
