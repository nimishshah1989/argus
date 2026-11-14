// Common passwords refused at sign-up and on change (ticket 21/26). Source: the entries of 8 or more characters
// from SecLists (MIT) `Passwords/Common-Credentials/xato-net-10-million-passwords-1000.txt` and
// `Passwords/Common-Credentials/Pwdb_top-1000.txt`, lower-cased, de-duplicated, profanity removed. Shorter entries are
// left out because a password under 8 characters is refused anyway.
const WORDS = `
password 12345678 123456789 baseball football qwertyuiop 1234567890 superman 1qaz2wsx trustno1 jennifer
sunshine iloveyou starwars computer michelle 11111111 princess 987654321 corvette 1234qwer 88888888
q1w2e3r4t5 internet samantha whatever maverick steelers mercedes 123123123 qwer1234 hardcore q1w2e3r4
midnight bigdaddy victoria 1q2w3e4r cocacola marlboro asdfasdf 87654321 12344321 jordan23 jonathan liverpoo
danielle abcd1234 scorpion qazwsxedc password1 slipknot qwerty123 startrek 12341234 redskins butthead
asdfghjkl qwertyui liverpool dolphins nicholas elephant mountain xxxxxxxx 1q2w3e4r5t metallic benjamin
creative rush2112 asdfghjk 4815162342 passw0rd 1qazxsw2 garfield 01012011 69696969 december 11223344 godzilla
airborne lifehack brooklyn platinum darkness blink182 789456123 12qwaszx snowball pakistan redwings williams
nintendo guinness november minecraft asdf1234 lasvegas babygirl 12121212 147258369 explorer snickers
metallica alexande paradise michigan carolina lacrosse christin kimberly kristina 0987654321 poohbear
bollocks qweasdzxc drowssap caroline einstein spitfire maryjane 1232323q champion svetlana westside courtney
12345qwert patricia aaaaaaaa anderson security stargate simpsons scarface 123456789a 1234554321 cherokee
usuckballz1 veronica semperfi scotland marshall qwerty12 98765432 softball passport franklin alexander
55555555 zaq12wsx infinity kawasaki 77777777 vladimir freeuser wildcats budlight brittany 00000000 bulldogs
swordfis patriots pearljam colorado ncc1701d motorola logitech juventus wolverin warcraft hello123 peekaboo
123654789 panthers elizabet spiderma virginia valentin predator mitchell 741852963 1111111111 rolltide
changeme lovelove fktrcfylh loverboy chevelle cardinal michael1 147852369 american alexandr electric wolfpack
spiderman darkside 123456789q 01011980 q1w2e3r4t5y6 yuantuo2012 1qaz2wsx3edc 0123456789 aa123456 super123
chocolate d1lakiss 1234567891 butterfly 123qweasd basketball a123456789 12345678910 christian anhyeuem
nks230kjs82 rr123456rr 123hfjdk147 123456abc password123 qwerty12345 asdasdasd elizabeth 1q2w3e4r5t6y
barcelona pokemon1 iloveyou1 liverpool1 123qweasdzxc indya123 a1b2c3d4 startfinding friendster qazwsx123
charlie1 lizottes 1234abcd spongebob princess1 sebastian passwort azertyuiop groupd2013 comeon11 football1
r9lw4j8khx 123qwe123 inuyasha alexandra 123456aa september hallo123 twilight myspace1 beautiful stephanie
asdasd123 swordfish tinkerbell 2012comeer 0000000000 charlotte 999999999 hellokitty 1a2b3c4d abc123456
qwert123 manchester marseille welcome1 icecream precious lollipop india123 christine jessica1 greenday
portugal 9876543210 qq123456 leonardo superman1 1234567a cristina bismillah a1234567 asd123456 runescape
matthew1 qwerty123456 963852741 isabella sterling arsenal1 anthony1 chelsea1 mahalkita catherine rockstar
12345qwerty 12345678a 1029384756 fernando abc12345 remember emmanuel blahblah qwerty1234 shopping isabelle
youbye123 superstar computer1 cambiami 123698745 6v21wbgad 1122334455 aobo2010 21212121 qqww1122 password12
valentina qwerasdf pa55word william1 1123581321 demon1q2w3e angelina christopher iloveyou2 undertaker
linkinpark angelica demon1q2w3e4r sunshine1 1464688081 asdqwe123 nonmember baseball1 a1s2d3f4 demon1q2w3e4r5t
lincogo1 159753qq chouchou zxcvbnm123 password2 ihateyou qwert12345 microsoft christina dragonball gangster
killer123 147896325 alejandro santiago qweasd123 strawberry sunflower blink123 assassin telechargement
1234512345 brandon1 abcdefgh mamapapa starwars1 harrypotter samsung1 a12345678 kingkong facebook motdepasse
bearshare asdf12345 alexandre megaparol12345 pokemon123 ragnarok savannah jasmine1 california australia
realmadrid zxcvbnm1 justinbieber admin123 baili123com wow12345 qwerty321 golfcourse pk3x7w9w 1qa2ws3ed
freedom1 nyq28giz1z cheyenne florence test1234 chicken1 oblivion crossfire bestfriend pass1234 g13916055158
`;

// Added by us, not from the lists above: the defaults people actually pick in an Indian plant, which the lists
// miss because they strip or never contain punctuation (`Admin@123` is `admin123` once the `@` is gone).
const OUR_ADDITIONS = `
password123 password1234 welcome123 welcome1234 india123 india1234 admin123 admin1234 admin12345 india2024
india2025 india2026 factory123 plant1234 company123 temp1234 temporary1 changeme1 changeme123 letmein123
user1234 test1234 qwerty1234 pass1234 abc123456 abcd12345 uptimo123 cosmos123 cosmos1234 maintenance1
`;

export const COMMON_PASSWORDS: readonly string[] = [
  ...new Set([...WORDS.trim().split(/\s+/), ...OUR_ADDITIONS.trim().split(/\s+/)]),
];
