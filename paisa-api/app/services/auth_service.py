import logging

from pymongo.errors import DuplicateKeyError

from app.core.errors import Conflict, Unauthorized
from app.core.security import hash_password, verify_password
from app.db.models import User
from app.schemas.auth import LoginIn, RegisterIn

logger = logging.getLogger("paisa")


async def register_user(data: RegisterIn) -> User:
    user = User(
        email=data.email.lower(),
        name=data.name,
        password_hash=hash_password(data.password),
    )
    try:
        await user.insert()
    except DuplicateKeyError:
        # Not check-then-insert. Two requests at once would both pass the
        # check and both insert. Let the unique index decide.
        raise Conflict("Email already registered")

    logger.info("user_registered id=%s", user.id)
    return user


async def authenticate(data: LoginIn) -> User:
    user = await User.find_one(User.email == data.email.lower())

    # Same message whether the email is missing or the password is wrong.
    # Otherwise the endpoint tells an attacker which emails exist.
    if user is None or not verify_password(data.password, user.password_hash):
        logger.warning("login_failed email=%s", data.email)
        raise Unauthorized("Invalid email or password")

    logger.info("login_success id=%s", user.id)
    return user
