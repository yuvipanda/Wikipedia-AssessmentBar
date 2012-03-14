#!/bin/bash
CATEGORY=Unassessed_India_articles
curl -d "language=en&categories=$CATEGORY&depth=0&ns[1]=1&format=csv&doit=Do it\!" http://toolserver.org/~magnus/catscan_rewrite.php | sed 's/"Talk:\([^"]*\).*"/\1/' > $CATEGORY.tmp
mv $CATEGORY.tmp $CATEGORY
