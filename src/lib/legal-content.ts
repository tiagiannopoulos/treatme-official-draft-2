/**
 * the legal copy, stored as markdown so it can be replaced by pasting a new
 * document in here without touching any layout code.
 */

export const PRIVACY_MD = `this is a working draft, not legal advice. it covers what treatme actually does with data as built. have a canadian privacy lawyer review it before you launch, particularly the biometric sections — pipeda and ontario's health privacy rules are unforgiving on face data.

## who we are

treatme is operated by treatme technologies inc., a company incorporated in ontario, canada. we can be reached at privacy@treatme.app.

for the purposes of canada's personal information protection and electronic documents act (pipeda), treatme technologies inc. is the organization responsible for the personal information described here.

## what this policy covers

this policy explains what we collect when you use the treatme app or website, why we collect it, who we share it with, and what you can do about it.

## what we collect

**account information.** your name, email address, phone number, and city. you give us this when you create an account.

**face photographs and skin analysis data.** if you choose to use the skin scan, we process a photograph of your face to produce an estimated assessment of visible skin characteristics. this photograph, and the analysis derived from it, is biometric information. we treat it as sensitive personal information.

**booking information.** when you request a consultation, we collect the treatment, provider and clinic you selected, your preferred appointment times, and any note you write.

**conversation data.** if you use the in-app consult chat, we store the messages you send and the preferences we extract from them, such as your budget range and how much downtime you can tolerate.

**usage information.** basic technical information such as device type, app version, and error logs, used to keep the app working.

**what we do not collect.** we do not collect your medical records. we do not ask for a health card number. we do not track you across other apps or websites.

## how we use it

to produce your skin analysis and show you the results

to recommend treatments and match you with providers and clinics

to send your booking request to the clinic you selected, and to confirm your appointment

to let you compare scans over time, if you chose to save your photo

to keep the app secure and working

we do not sell your personal information. we do not sell or license your face photograph or your skin analysis to anyone, including skincare brands, device manufacturers, or advertisers.

## the skin scan, specifically

**consent.** we ask for your express consent before we process any photograph of your face. you cannot use the scan without giving it. we ask separately whether you want the photograph saved.

**how it works.** your photograph is sent to a third-party artificial intelligence provider that returns an estimated assessment of visible skin characteristics. that provider processes the image to generate the response and does not use it to train its models.

**if you decline photo storage.** your photograph is used to produce the analysis and is not written to our storage. we keep the resulting scores.

**if you accept photo storage.** your photograph is stored in a private, access-controlled location. only you can retrieve it. you can delete it at any time from your profile.

**what the analysis is not.** the skin analysis is an estimate produced by an artificial intelligence model. it is not a medical diagnosis, it has not been clinically validated, and it does not replace assessment by a qualified healthcare provider.

## who we share it with

**clinics and providers you choose.** when you submit a booking request, we share your name, phone number, email address, the treatment you selected and your preferred times with that clinic or provider so they can contact you and confirm. we do not share your face photograph or your skin analysis with a clinic unless you explicitly choose to send it.

**service providers.** we use third parties to run the app: a database and hosting provider, an artificial intelligence provider for the skin analysis and chat, an email provider for notifications, and a payment processor if and when you pay through the app. each is bound to use your information only to provide that service to us.

**cross-border processing.** some of these providers process data outside canada, including in the united states. while your information is in another country it may be accessible to that country's courts and law enforcement under that country's laws.

**legal requirements.** we may disclose information where required by law, or to protect the safety of a person.

## how long we keep it

- account information: while your account is open, then deleted within 30 days of account deletion
- face photographs: until you delete them, or until you delete your account
- skin analysis scores: until you delete your account
- booking requests: 24 months, so you and the clinic have a record of what was agreed
- chat conversations: 12 months

## your choices

you can, at any time, from your profile:

- see what we hold about you
- correct your name, email, phone or city
- delete your scan photographs without deleting your account
- withdraw your consent to biometric processing, which stops all future scans and deletes your existing photographs and analyses
- delete your account entirely, which removes your profile, your scans, your photographs, your chat history and your booking requests

deletion is real. we remove the files, not just the database records.

you can also email privacy@treatme.app for any of the above, or to ask a question. we respond within 30 days.

## security

face photographs are held in private storage that is not publicly readable. access is restricted so that a signed-in user can only reach their own files. database access is governed by row-level security policies enforced per user. api credentials are held server-side and are never present in the app you download.

no system is perfect. if a breach occurs that creates a real risk of significant harm, we will notify you and the office of the privacy commissioner of canada as pipeda requires.

## children

treatme is not for anyone under 18. we do not knowingly create accounts for or collect information from minors. if we learn we have, we delete it.

## changes

if we change this policy in a way that affects how we handle your biometric information, we will ask for your consent again rather than relying on the old one.

## complaints

if you are not satisfied with how we handled your information, you can contact us at privacy@treatme.app.
`;

export const TERMS_MD = `alpha version. plain words, no fine print.

## this isn't medical advice

a treatme scan is an estimate from a photo. it doesn't diagnose anything. see a doctor for anything that concerns you.

## you must be 18 or older

treatme is for adults. by using it you confirm you're 18 or older.

## your photo, your call

you decide whether we save your photo, and you can delete it and the scan built from it whenever you like.

## bookings

treatme passes your request to the clinic. the clinic confirms the time and performs the treatment, and their own policies apply.

## alpha

treatme is early. things will change, and we'll tell you when something meaningful does.
`;
