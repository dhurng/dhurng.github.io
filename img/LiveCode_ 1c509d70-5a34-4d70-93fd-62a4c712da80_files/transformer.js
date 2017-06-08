// Transformation Related Functions
isConsecutiveChange = function (first, second) {
  if(first && second && first.action == second.action) {
    if(first.action[0] == "i") {
      if(first.end.row == second.start.row && first.end.column == second.start.column) {
        return true;
      }
    } else {
      if(first.start.row == second.start.row && first.start.column == second.end.column && first.lines.length == 1 && second.lines.length == 1) {
        return true;
      }
    }
  }
  return false;
};

isOneLiner = function(change) {
  return change.lines == 1;
};

isInsert = function(change) {
  return change.action.startsWith("i");
};

isRemove = function(change) {
  return change.action.startsWith("r");
};

compareChangeLocations = function(first, second) {
  if(first.start)
    return compareLocations(first.start, second.start);
  else if (first.row)
    return compareLocations(first, second);
};

compareLocations = function(firstLocation, secondLocation) {
  if(firstLocation.row == secondLocation.row &&
     firstLocation.column == secondLocation.column) {
    return 0;
  }

  if(firstLocation.row < secondLocation.row)
    return 1;

  if(firstLocation.row == secondLocation.row && firstLocation.column < secondLocation.column)
    return 1;

  return -1;
};

areAtSameLocation = function (first, second) {
  return compareChangeLocations(first, second) == 0;
};

isAfter = function (first, second) {
  return compareChangeLocations(first, second) == -1;
};

isBefore = function (first, second) {
  return compareChangeLocations(first, second) == 1;
};

isBeforeOrAtSameLocation = function (first, second) {
  return compareChangeLocations(first, second) >= 0;
};

isAfterOrAtSameLocation = function (first, second) {
  return compareChangeLocations(first, second) <= 0;
};

areInSameRow = function(first, second) {
  if(first.start) {
    // this is a change item
    if (first.start.row == second.start.row)
      return true;

    return false;
  } else {
    // this is a location item
    if(first.row == second.row)
      return true;
    return false;
  }
};

columnOffset = function(change, offset) {
  if(offset == 0)
    return;

  change.start.column += offset;
  if(change.lines.length == 1)
    change.end.column += offset;
};

rowOffset = function (change, offset) {
  if(offset == 0)
    return;
  change.start.row += offset;
  change.end.row += offset;
};

isOverlapped = function (change, referenceChange) {
  if(isBeforeOrAtSameLocation(referenceChange.end, change.start))
    return false;
  else if(isAfterOrAtSameLocation(referenceChange.start, change.end))
    return false;

  return true;
};

trimLeft = function(change, referenceChange) {
  var rDiff = referenceChange.end.row - change.start.row;
  if(rDiff == 0) {
    var diff = referenceChange.end.column - change.start.column;
    change.start = referenceChange.end;
    change.lines[0] = change.lines[0].substr(diff);
  } else {
    for(var i = 0; i < rDiff; i++)
      change.lines.shift();
    var diff = referenceChange.end.column;
    change.start = referenceChange.end;
    change.lines[0] = change.lines[0].substr(diff);
  }
};

trimRight = function (change, referenceChange) {
  var rDiff = change.end.row - referenceChange.start.row;
  var size = change.lines.length;
  if(rDiff == 0) {
    var diff = change.end.column - referenceChange.start.column;
    change.end = referenceChange.start;
    change.lines[size - 1] = change.lines[size-1].substring(0, diff+1);
  } else {
    for(var i = size - 1; i > size-rDiff-1; i--) {
      change.lines.pop();
    }
    var diff = referenceChange.start.column;
    var end = referenceChange.start;
    size = change.lines.length;
    if(size > 1)
      change.lines[size - 1] = change.lines[size - 1].substring(0, diff);
    else
      change.lines[size - 1] = change.lines[size - 1].substring(0, referenceChange.start.column-change.start.column);
  }
};

insertTransform = function (change, referenceChange) {
  if(isBefore(change, referenceChange))
    return;

  if(areInSameRow(change, referenceChange)) {
    columnOffset(change, referenceChange.lines[0].length);
    var diff = referenceChange.start.column - change.start.column - 1;
    for(var i = 1; i < referenceChange.lines.length; i++ ) {
      columnOffset(change, diff+referenceChange.lines[i].length);
      diff = -referenceChange.lines[i].length;
    }
  }

  if(referenceChange.lines.length > 1)
    rowOffset(change, referenceChange.lines.length - 1);
};



removeTransform = function (change, referenceChange) {
  if(isBefore(change, referenceChange) && !isOverlapped(change, referenceChange))
    return;

  if(isOverlapped(change, referenceChange)) {
    if(isInsert(change) && isAfter(change.start, referenceChange.start)) {
      var rDiff = change.start.row - referenceChange.start.row;
      if(rDiff > 0) {
        rowOffset(change, -rDiff);
      }
      var cDiff = change.start.column - referenceChange.start.column;
      columnOffset(change, -cDiff);
    } else if(isRemove(change)) {
      if(isBeforeOrAtSameLocation(referenceChange.start, change.start) && isBefore(referenceChange.end, change.end)) {
        setIgnore(true);
      } else {
        if(isBefore(referenceChange.start, change.start) && isBefore(referenceChange.end, change.end)) {
          trimLeft(change, referenceChange);
          removeTransform(change, referenceChange);
        } else if(isAfter(referenceChange.start, change.start)) {
          trimRight(change, referenceChange);
        }
      }
    }
  } else {
    if(isOneLiner(referenceChange)) {
      if(isBefore(change, referenceChange)) {
        columnOffset(change, -referenceChange.lines[0].length);
      }
    } else {
      if(areInSameRow(change.start, referenceChange.end)) {
        columnOffset(change, referenceChange.start.column - referenceChange.end.column);
      }
      rowOffset(change, -(referenceChange.lines.length - 1));
    }
  }
};

transformBasedOnItem = function (delta, referenceDelta) {
  if(referenceDelta.clientId == delta.clientId || isBefore(delta.change, referenceDelta.change) || !delta.change || !referenceDelta.change)
    return;
  refChange = referenceDelta.change;
  change = delta.change;
  if(refChange.action == "insert") {
    insertTransform(change, refChange);
  } else {
    removeTransform(change, refChange);
  }
};

transformBasedOnList = function (delta, referenceDeltas) {
  if(!referenceDeltas || !delta || delta.change == null)
    return;

  for(var i = 0; i < referenceDeltas.length; i++) {
    transformBasedOnItem(referenceDeltas[i], delta);
  }

};
