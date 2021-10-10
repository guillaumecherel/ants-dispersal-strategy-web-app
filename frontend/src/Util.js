export const dateFromUnixEpoch = seconds => new Date(seconds * 1000);

const dateFormatterFr = Intl.DateTimeFormat("fr-FR", {dateStyle: "medium", timeStyle: 'long'});
export const formatDate = dateFormatterFr.format;

const shortDateFormatterFr = Intl.DateTimeFormat("fr-FR", {dateStyle: "short", timeStyle: 'long'});
export const shortDate = shortDateFormatterFr.format;

export const set = propName => setProp => obj => {
  if (!(propName in obj)) {
    throw Error("Instance of " + obj?.constructor.name + " does not contain property " + propName)
  }
  let res = Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
  return Object.assign(res, {[propName]: setProp(obj[propName])});
}

export const val = x => _ => x

export const set_ = (...propNames) => value => {
  if (propNames.length === 0) {
    throw Error("function set_ expects at least one argument");
  } else if (propNames.length === 1) {
    return set(propNames[0])(val(value));
  } else {
    return set(propNames[0])(set_(...propNames.slice(1))(value));
  }
}

export const compose = (f, g) => x => g(f(x));
export const chain = (f, g) => x => f(g(x));

export const equals = (a, b) => {
  if (!(a instanceof Object && b instanceof Object)) {
    return a === b;
  }

  if (Object.keys(a)?.length !== Object.keys(b)?.length) {
    return false
  }

  for (const key in a) {
    if (a[key] instanceof Object ) {
      if (!equals(a[key], b[key])) {
        return false;
      }
    } else if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};

